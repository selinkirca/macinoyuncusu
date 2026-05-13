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

def calculate_points():
    try:
        res = supabase.table("matches").select("*").eq("status", "FINISHED").execute()
        for match in res.data:
            if not match.get('mvp_name'): continue
            pred_res = supabase.table("predictions").select("*").eq("match_id", match['id']).eq("is_processed", False).execute()
            for p in pred_res.data:
                points = 0
                if str(match.get('winner')) == str(p['predicted_winner']):
                    points += 10
                if p['predicted_mvp'] and match['mvp_name']:
                    if p['predicted_mvp'].strip().lower() == match['mvp_name'].strip().lower():
                        points += 5
                supabase.table("predictions").update({"is_processed": True, "points_earned": points}).eq("id", p['id']).execute()
                if points > 0:
                    prof = supabase.table("profiles").select("total_points").eq("id", p['user_id']).single().execute()
                    if prof.data:
                        new_total = (prof.data['total_points'] or 0) + points
                        supabase.table("profiles").update({"total_points": new_total}).eq("id", p['user_id']).execute()
    except Exception as e: print(f"Puan hatası: {e}")

def update_loop():
    leagues = {'TR': 2023, 'WC': 2000, 'CL': 2001, 'PL': 2021, 'PD': 2014, 'BL1': 2002, 'SA': 2019, 'FL1': 2015}
    while True:
        calculate_points()
        headers = {'X-Auth-Token': FB_API_KEY}
        for code, comp_id in leagues.items():
            url = f"https://api.football-data.org/v4/competitions/{comp_id}/matches?dateFrom={(datetime.now()-timedelta(days=3)).strftime('%Y-%m-%d')}&dateTo={(datetime.now()+timedelta(days=7)).strftime('%Y-%m-%d')}"
            try:
                r = requests.get(url, headers=headers)
                if r.status_code == 200:
                    matches = r.json().get('matches', [])
                    for m in matches:
                        s = m.get('score', {})
                        # SKOR ÇEKME MANTIĞINI GARANTİYE ALIYORUZ
                        # fullTime yoksa regularTime, o da yoksa direkt score içindeki home/away
                        h = s.get('fullTime', {}).get('home')
                        if h is None: h = s.get('regularTime', {}).get('home')
                        if h is None: h = s.get('home') # Bazı API versiyonları için
                        
                        a = s.get('fullTime', {}).get('away')
                        if a is None: a = s.get('regularTime', {}).get('away')
                        if a is None: a = s.get('away')

                        data = {
                            "id": m['id'],
                            "home_team": m['homeTeam']['name'],
                            "away_team": m['awayTeam']['name'],
                            "status": m['status'],
                            "home_score": int(h) if h is not None else 0,
                            "away_score": int(a) if a is not None else 0,
                            "home_logo": m['homeTeam']['crest'],
                            "away_logo": m['awayTeam']['crest'],
                            "winner": s.get('winner'),
                            "match_time": m['utcDate'],
                            "competition_code": code
                        }
                        supabase.table("matches").upsert(data).execute()
                    print(f"✅ {code} ligi güncellendi.")
                elif r.status_code == 429:
                    time.sleep(60)
                time.sleep(6)
            except Exception as e: print(f"Hata ({code}): {e}")
        time.sleep(900)

if __name__ == "__main__":
    threading.Thread(target=run_health_server, daemon=True).start()
    update_loop()
