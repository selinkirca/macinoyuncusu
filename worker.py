import time
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timedelta
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

# ÖNEMLİ: Render panelinden Service Role Key'i SB_KEY olarak gir!
SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY") 
FB_API_KEY = os.getenv("FB_API_KEY")

supabase = create_client(SB_URL, SB_KEY)

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Worker is running...")
    
    def do_HEAD(self): # Render'ın kontrol hatasını bu çözer
        self.send_response(200)
        self.end_headers()

def run_health_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), HealthCheckHandler)
    server.serve_forever()

# --- Puan Dağıtım Fonksiyonu ---
def calculate_points():
    try:
        res = supabase.table("matches").select("*").eq("status", "FINISHED").execute()
        for match in res.data:
            if not match.get('mvp_name'): continue
            pred_res = supabase.table("predictions").select("*").eq("match_id", match['id']).eq("is_processed", False).execute()
            for p in pred_res.data:
                points = 10 if match.get('winner') == p['predicted_winner'] else 0
                if p['predicted_mvp'] and match['mvp_name'] and p['predicted_mvp'].strip().lower() == match['mvp_name'].strip().lower():
                    points += 5
                supabase.table("predictions").update({"is_processed": True, "points_earned": points}).eq("id", p['id']).execute()
                if points > 0:
                    prof = supabase.table("profiles").select("total_points").eq("id", p['user_id']).single().execute()
                    if prof.data:
                        supabase.table("profiles").update({"total_points": prof.data['total_points'] + points}).eq("id", p['user_id']).execute()
    except Exception as e: print(f"Puan hatası: {e}")

# --- Maç Güncelleme Fonksiyonu ---
def update_loop():
    leagues = {'WC': 2000, 'CL': 2001, 'PL': 2021, 'PD': 2014, 'BL1': 2002, 'SA': 2019, 'FL1': 2015, 'TR': 2023}
    while True:
        calculate_points() # Maç güncellemeden önce puanları dağıt
        headers = {'X-Auth-Token': FB_API_KEY}
        for code in leagues.keys():
            url = f"https://api.football-data.org/v4/competitions/{code}/matches?dateFrom={(datetime.now()-timedelta(days=3)).strftime('%Y-%m-%d')}&dateTo={(datetime.now()+timedelta(days=7)).strftime('%Y-%m-%d')}"
            try:
                r = requests.get(url, headers=headers)
                if r.status_code == 200:
                    for m in r.json().get('matches', []):
                        score = m.get('score', {}).get('fullTime', {})
                        data = {
                            "id": m['id'], "home_team": m['homeTeam']['name'], "status": m['status'],
                            "home_score": score.get('home') or 0, "away_score": score.get('away') or 0,
                            "winner": m.get('score', {}).get('winner'), "competition_code": code
                        }
                        supabase.table("matches").upsert(data).execute()
                time.sleep(6)
            except Exception as e: print(f"Lig hatası: {e}")
        time.sleep(900)

if __name__ == "__main__":
    threading.Thread(target=run_health_server, daemon=True).start()
    update_loop()
