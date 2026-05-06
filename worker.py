import time
from datetime import datetime, timedelta
import requests
from supabase import create_client
from dotenv import load_dotenv

load_dotenv() # .env dosyasını yükler

SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY")
FB_API_KEY = os.getenv("FB_API_KEY")

# Takip edilen ligler
ELITE_LEAGUES = {
    'WC': 2000,    # World Cup 2026
    'CL': 2001,    # Champions League
    'PL': 2021,    # Premier League
    'PD': 2014,    # La Liga
    'BL1': 2002,   # Bundesliga
    'SA': 2019,    # Serie A
    'FL1': 2015,   # Ligue 1
}

supabase = create_client(SB_URL, SB_KEY)

def update_elite_matches():
    headers = {'X-Auth-Token': FB_API_KEY}
    all_matches_processed = 0
    
    # Tarih Aralığı: Son 3 gün ve Gelecek 7 gün
    start_date = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')  
    end_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
    
    # Dünya Kupası 2026 özel aralığı
    wc_start = "2026-06-01"
    wc_end = "2026-07-31"

    print(f"\n[{time.strftime('%H:%M:%S')}] Lig Güncelleme Başlatıldı...")

    for league_code, league_id in ELITE_LEAGUES.items():
        if league_code == 'WC':
            url = f"https://api.football-data.org/v4/competitions/{league_code}/matches?dateFrom={wc_start}&dateTo={wc_end}"
        else:
            url = f"https://api.football-data.org/v4/competitions/{league_code}/matches?dateFrom={start_date}&dateTo={end_date}"
            
        try:
            response = requests.get(url, headers=headers)
            
            if response.status_code in [403, 404]:
                print(f"❌ {league_code}: API planına dahil değil veya kod hatalı.")
                continue
                
            if response.status_code == 429:
                print(f"⚠️ API Limiti! 60 sn bekleniyor...")
                time.sleep(60)
                continue
                
            if response.status_code != 200:
                print(f"⚠️ {league_code} hatası: {response.status_code}")
                continue
                
            data = response.json()
            matches = data.get('matches', [])
            
            for m in matches:
                score = m.get('score', {})
                full_time = score.get('fullTime', {})
                
                match_data = {
                    "id": m['id'],
                    "home_team": m['homeTeam']['name'],
                    "home_logo": m['homeTeam'].get('crest'),
                    "away_team": m['awayTeam']['name'],
                    "away_logo": m['awayTeam'].get('crest'),
                    "status": m['status'],
                    "match_time": m['utcDate'],
                    "home_score": full_time.get('home') if full_time.get('home') is not None else 0,
                    "away_score": full_time.get('away') if full_time.get('away') is not None else 0,
                    "winner": score.get('winner'),
                    "competition_code": league_code,
                    "updated_at": datetime.utcnow().isoformat()
                }
                
                supabase.table("matches").upsert(match_data).execute()
                all_matches_processed += 1
            
            print(f"✅ {league_code} güncellendi.")
            time.sleep(6) # API yormamak için bekleme

        except Exception as e:
            print(f"💥 {league_code} sistem hatası: {e}")

    print(f"🏁 Toplam {all_matches_processed} maç senkronize edildi.")

if __name__ == "__main__":
    while True:
        try:
            update_elite_matches()
        except Exception as e:
            print(f"❌ Kritik hata: {e}")
        time.sleep(900) # 15 dakikada bir çalış