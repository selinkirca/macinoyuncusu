import requests
import time
from supabase import create_client
from dotenv import load_dotenv

load_dotenv() # .env dosyasını yükler

SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY")
FB_API_KEY = os.getenv("FB_API_KEY")

supabase = create_client(SB_URL, SB_KEY)

# 5 Büyük Ligin ID'leri
LEAGUE_IDS = [2021, 2014, 2002, 2019, 2015]

def sync_players():
    headers = {'X-Auth-Token': FB_API_KEY}
    
    for league_id in LEAGUE_IDS:
        print(f"\n⚽ Lig {league_id} takımları çekiliyor...")
        url = f"https://api.football-data.org/v4/competitions/{league_id}/teams"
        
        try:
            res = requests.get(url, headers=headers)
            if res.status_code == 429:
                print("⚠️ API Limiti! 60 saniye bekleme...")
                time.sleep(60)
                continue

            teams = res.json().get('teams', [])
            
            for team in teams:
                team_id = team['id']
                team_name = team['name']
                print(f"  -> {team_name} kadrosu kaydediliyor...")
                
                squad = team.get('squad', [])
                if not squad: continue

                players_to_upsert = []
                for player in squad:
                    players_to_upsert.append({
                        "player_name": player['name'],
                        "team_name": team_name,
                        "team_id": team_id,
                        "league_id": league_id
                    })

                # Veritabanına toplu gönderim
                if players_to_upsert:
                    try:
                        # on_conflict SQL'deki kural ile BİREBİR aynı olmalı
                        supabase.table("players").upsert(
                            players_to_upsert, 
                            on_conflict="player_name,team_name" 
                        ).execute()
                    except Exception as e:
                        print(f"     ❌ Supabase Hatası: {e}")
                
                # API limitini aşmamak için takım başına 6 saniye bekle
                time.sleep(6)

        except Exception as e:
            print(f"💥 Lig {league_id} hatası: {e}")

if __name__ == "__main__":
    print("🚀 Player Sync Worker başlatıldı.")
    sync_players()
    print("✅ Tüm oyuncular başarıyla senkronize edildi.")