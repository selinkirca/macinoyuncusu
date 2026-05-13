import time
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY") 
FB_API_KEY = os.getenv("FB_API_KEY")

supabase = create_client(SB_URL, SB_KEY)

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Worker is running...")
    
    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()

def run_health_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    server.serve_forever()

# --- Puan Dağıtım Fonksiyonu ---
def calculate_points():
    try:
        # Sadece bitmiş ve puanı henüz dağıtılmamış maçları işle
        res = supabase.table("matches").select("*").eq("status", "FINISHED").execute()
        for match in res.data:
            if not match.get('mvp_name'): continue
            
            pred_res = supabase.table("predictions").select("*").eq("match_id", match['id']).eq("is_processed", False).execute()
            for p in pred_res.data:
                points = 0
                # Kazanan tahmini kontrolü (winner: HOME_TEAM, AWAY_TEAM veya DRAW)
                if match.get('winner') == p['predicted_winner']:
                    points += 10
                
                # MVP tahmini kontrolü (küçük/büyük harf duyarsız)
                if p['predicted_mvp'] and match['mvp_name']:
                    if p['predicted_mvp'].strip().lower() == match['mvp_name'].strip().lower():
                        points += 5
                
                # Tahmini işle ve puanı kaydet
                supabase.table("predictions").update({"is_processed": True, "points_earned": points}).eq("id", p['id']).execute()
                
                # Kullanıcının toplam puanını güncelle
                if points > 0:
                    prof = supabase.table("profiles").select("total_points").eq("id", p['user_id']).single().execute()
                    if prof.data:
                        new_total = (prof.data['total_points'] or 0) + points
                        supabase.table("profiles").update({"total_points": new_total}).eq("id", p['user_id']).execute()
    except Exception as e: print(f"Puan hatası: {e}")

# --- Maç Güncelleme Fonksiyonu ---
def update_loop():
    # TR ligini (2023) en başa alalım, öncelikli olsun
    leagues = {'TR': 2023, 'WC': 2000, 'CL': 2001, 'PL': 2021, 'PD': 2014, 'BL1': 2002, 'SA': 2019, 'FL1': 2015}
    while True:
        calculate_points()
        headers = {'X-Auth-Token': FB_API_KEY}
        
        for code, competition_id in leagues.items():
            # Hem geçmiş (3 gün) hem gelecek (7 gün) maçları al
            url = f"https://api.football-data.org/v4/competitions/{competition_id}/matches?dateFrom={(datetime.now()-timedelta(days=3)).strftime('%Y-%m-%d')}&dateTo={(datetime.now()+timedelta(days=7)).strftime('%Y-%m-%d')}"
            
            try:
                r = requests.get(url, headers=headers)
                if r.status_code == 200:
                    matches = r.json().get('matches', [])
                    for m in matches:
                        # Skor verisini daha güvenli çekiyoruz
                        ft_score = m.get('score', {}).get('fullTime', {})
                        home_score = ft_score.get('home')
                        away_score = ft_score.get('away')
                        
                        # Skor None ise (maç başlamadıysa) 0 olarak kaydet
                        data = {
                            "id": m['id'],
                            "home_team": m['homeTeam']['name'],
                            "away_team": m['awayTeam']['name'], # Deplasman ismini de ekleyelim
                            "status": m['status'],
                            "home_score": home_score if home_score is not None else 0,
                            "away_score": away_score if away_score is not None else 0,
                            "winner": m.get('score', {}).get('winner'),
                            "match_time": m['utcDate'], # BU ÇOK ÖNEMLİ: Listeleme için şart
                            "competition_code": code
                        }
                        supabase.table("matches").upsert(data).execute()
                    print(f"✅ {code} ligi güncellendi.")
                elif r.status_code == 429:
                    print("⚠️ API Limiti! 60 sn bekleniyor...")
                    time.sleep(60)
                
                time.sleep(6) # Her lig isteği arasında 6 saniye bekle (API limiti için)
            except Exception as e:
                print(f"Lig hatası ({code}): {e}")
        
        print("😴 Tüm ligler tarandı, 15 dk bekleniyor...")
        time.sleep(900)

if __name__ == "__main__":
    threading.Thread(target=run_health_server, daemon=True).start()
    update_loop()
