import time
from supabase import create_client
from dotenv import load_dotenv

load_dotenv() # .env dosyasını yükler

SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY")
FB_API_KEY = os.getenv("FB_API_KEY")
supabase = create_client(SB_URL, SB_KEY)

def calculate_points():
    print(f"\n[{time.strftime('%H:%M:%S')}] Puan Motoru Taramaya Başlıyor...")
    
    try:
        # 1. Bitmiş maçları getir
        res = supabase.table("matches").select("*").eq("status", "FINISHED").execute()
        
        if not res.data:
            print("ℹ️ Puanlanacak maç bulunamadı.")
            return

        for match in res.data:
            # ÖNEMLİ: Admin MVP seçmediyse bu maçı beklemede tut
            if not match.get('mvp_name'):
                print(f"⏳ {match['home_team']} - {match['away_team']} için MVP seçimi bekleniyor...")
                continue

            # 2. Bu maçın işlenmemiş tahminlerini getir
            pred_res = supabase.table("predictions")\
                .select("*")\
                .eq("match_id", match['id'])\
                .eq("is_processed", False)\
                .execute()
            
            if not pred_res.data:
                continue

            print(f"⚽ {match['home_team']} - {match['away_team']} için puanlar dağıtılıyor...")

            for p in pred_res.data:
                points_to_add = 0
                
                # Kazanan Kontrolü (+10 Puan)
                if match.get('winner') == p['predicted_winner']:
                    points_to_add += 10
                
                # MVP Kontrolü (+5 Puan)
                if p['predicted_mvp'] and match['mvp_name']:
                    if p['predicted_mvp'].strip().lower() == match['mvp_name'].strip().lower():
                        points_to_add += 5

                # 3. Tahmini İşlendi Olarak İşaretle
                supabase.table("predictions").update({
                    "is_processed": True,
                    "points_earned": points_to_add
                }).eq("id", p['id']).execute()

                # 4. Kullanıcı Profiline Puanı Ekle
                if points_to_add > 0:
                    profile_res = supabase.table("profiles").select("total_points").eq("id", p['user_id']).single().execute()
                    
                    if profile_res.data:
                        new_total = (profile_res.data.get('total_points') or 0) + points_to_add
                        supabase.table("profiles").update({
                            "total_points": new_total
                        }).eq("id", p['user_id']).execute()
                        print(f"   💰 +{points_to_add} puan {p['user_id']} hesabına eklendi.")

        print("🏁 Puanlama işlemi tamamlandı.")

    except Exception as e:
        print(f"💥 Puan Motoru Hatası: {e}")

if __name__ == "__main__":
    print("🚀 Puan Dağıtım Sistemi Aktif.")
    while True:
        calculate_points()
        time.sleep(120) # 2 dakikada bir kontrol et