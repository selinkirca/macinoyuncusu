import time
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta
import requests
from supabase import create_client
from dotenv import load_dotenv

# .env dosyasını yükler (Yerelde .env'den, canlıda Render panelinden okur)
load_dotenv()

# --- AYARLAR ---
SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY")
FB_API_KEY = os.getenv("FB_API_KEY")

if not all([SB_URL, SB_KEY, FB_API_KEY]):
    print("❌ HATA: Gerekli Environment Variable'lar bulunamadı!")

supabase = create_client(SB_URL, SB_KEY)

# Takip edilen ligler
ELITE_LEAGUES = {
    'WC': 2000, 'CL': 2001, 'PL': 2021, 'PD': 2014, 
    'BL1': 2002, 'SA': 2019, 'FL1': 2015, 'TR': 2023
}

# --- RENDER SAĞLIK KONTROLÜ SUNUCUSU ---
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(b"Elite 5 Worker is Active and Running...")

def run_health_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    print(f"📡 Sağlık kontrolü sunucusu {port} portunda hazır.")
    server.serve_forever()

# --- PUAN HESAPLAMA MOTORU ---
def calculate_points():
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🪙 Puan Motoru Çalışıyor...")
    try:
        res = supabase.table("matches").select("*").eq("status", "FINISHED").execute()
        if not res.data: return

        for match in res.data:
            if not match.get('mvp_name'): continue

            pred_res = supabase.table("predictions").select("*")\
                .eq("match_id", match['id']).eq("is_processed", False).execute()
            
            if not pred_res.data: continue

            for p in pred_res.data:
                points_to_add = 0
                if match.get('winner') == p['predicted_winner']: points_to_add += 10
                if p['predicted_mvp'] and match['mvp_name']:
                    if p['predicted_mvp'].strip().lower() == match['mvp_name'].strip().lower():
                        points_to_add += 5

                supabase.table("predictions").update({"is_processed": True, "points_earned": points_to_add}).eq("id", p['id']).execute()

                if points_to_add > 0:
                    profile_res = supabase.table("profiles").select("total_points").eq("id", p['user_id']).single().execute()
                    if profile_res.data:
                        new_total = (profile_res.data.get('total_points') or 0) + points_to_add
                        supabase.table("profiles").update({"total_points": new_total}).eq("id", p['user_id']).execute()
    except Exception as e:
        print(f"💥 Puan Motoru Hatası: {e}")

# --- MAÇ GÜNCELLEME DÖNGÜSÜ ---
def main_worker_loop():
    headers = {'X-Auth-Token': FB_API_KEY}
    
    while True:
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] ⚽ Lig Güncelleme Başlatıldı...")
        
        # Puanları her döngü başında bir kez kontrol et
        calculate_points()

        start_date = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        end_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        for league_code in ELITE_LEAGUES.keys():
            url = f"https://api.football-data.org/v4/competitions/{league_code}/matches?dateFrom={start_date}&dateTo={end_date}"
            
            try:
                response = requests.get(url, headers=headers)
                if response.status_code == 200:
                    matches = response.json().get('matches', [])
                    for m in matches:
                        score = m.get('score', {})
                        full_time = score.get('fullTime', {})
                        match_data = {
                            "id": m['id'], "home_team": m['homeTeam']['name'],
                            "home_logo": m['homeTeam'].get('crest'),
                            "away_team": m['awayTeam']['name'],
                            "away_logo": m['awayTeam'].get('crest'),
                            "status": m['status'], "match_time": m['utcDate'],
                            "home_score": full_time.get('home') or 0,
                            "away_score": full_time.get('away') or 0,
                            "winner": score.get('winner'), "competition_code": league_code,
                            "updated_at": datetime.utcnow().isoformat()
                        }
                        supabase.table("matches").upsert(match_data).execute()
                    print(f"✅ {league_code} işlendi.")
                elif response.status_code == 429:
                    print("⚠️ Limit doldu, 1 dk bekleniyor...")
                    time.sleep(60)
                time.sleep(6) # API yormamak için
            except Exception as e:
                print(f"💥 {league_code} hatası: {e}")

        print(f"💤 15 dakika uyku moduna geçiliyor...")
        time.sleep(900)

if __name__ == "__main__":
    # Web sunucusunu yan thread'de başlat
    threading.Thread(target=run_health_server, daemon=True).start()
    
    # Ana döngüyü başlat
    main_worker_loop()
