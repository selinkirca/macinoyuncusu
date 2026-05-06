import time
from supabase import create_client
from dotenv import load_dotenv

load_dotenv() # .env dosyasını yükler

SB_URL = os.getenv("SB_URL")
SB_KEY = os.getenv("SB_KEY")
FB_API_KEY = os.getenv("FB_API_KEY")
supabase = create_client(SB_URL, SB_KEY)

def test_puan_sistemi():
    try:
        print("🚀 Test başlatılıyor...")

        # 1. TEST MAÇI OLUŞTUR (ID: 999999)
        test_match = {
            "id": 999999,
            "home_team": "Test Spor",
            "away_team": "Deneme İdman",
            "status": "FINISHED",
            "winner": "HOME_TEAM",
            "mvp_name": "Selin Kırca" # Adminin seçtiği MVP
        }
        supabase.table("matches").upsert(test_match).execute()
        print("✅ 1. Adım: Test maçı oluşturuldu (Skor: Ev Sahibi Kazandı).")

        # 2. SENİN İÇİN BİR TAHMİN OLUŞTUR
        # Önce kendi user_id'ni alalım (profiles tablosundaki ilk kullanıcıyı alıyorum test için)
        user_res = supabase.table("profiles").select("id").limit(1).execute()
        if not user_res.data:
            print("❌ Hata: Profiles tablosunda hiç kullanıcı yok!")
            return
        
        my_id = user_res.data[0]['id']

        test_prediction = {
            "user_id": my_id,
            "match_id": 999999,
            "predicted_winner": "HOME_TEAM", # Doğru tahmin
            "predicted_mvp": "Selin Kırca", # Doğru MVP
            "is_processed": False
        }
        supabase.table("predictions").upsert(test_prediction).execute()
        print(f"✅ 2. Adım: {my_id} ID'li kullanıcı için DOĞRU tahmin oluşturuldu.")

        # 3. PUAN MOTORUNU ÇALIŞTIR (Senin fonksiyonun aynısı)
        print("\n--- PUAN MOTORU TETİKLENİYOR ---")
        
        # Sadece bizim test maçını puanlayalım
        match = supabase.table("matches").select("*").eq("id", 999999).single().execute().data
        preds = supabase.table("predictions").select("*").eq("match_id", 999999).eq("is_processed", False).execute().data

        for p in preds:
            points = 0
            if match['winner'] == p['predicted_winner']: points += 10
            if p['predicted_mvp'] == match['mvp_name']: points += 5

            # Tahmini işle
            supabase.table("predictions").update({
                "is_processed": True, 
                "points_earned": points
            }).eq("id", p['id']).execute()

            # Profile puan ekle
            profile = supabase.table("profiles").select("total_points").eq("id", p['user_id']).single().execute().data
            new_total = (profile.get('total_points') or 0) + points
            supabase.table("profiles").update({"total_points": new_total}).eq("id", p['user_id']).execute()
            
            print(f"✅ 3. Adım: Başarılı! Kullanıcıya {points} puan eklendi. Yeni Toplam: {new_total}")

        print("\n🏆 TEST TAMAMLANDI. Profil sayfana gidip puanına bakabilirsin!")

    except Exception as e:
        print(f"💥 Test sırasında hata: {e}")

if __name__ == "__main__":
    test_puan_sistemi()