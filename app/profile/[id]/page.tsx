"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const targetUserId = params.id as string; // URL'deki ID'yi alıyoruz

  const [profile, setProfile] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (targetUserId) {
      loadProfile();
    }
  }, [targetUserId]);

  async function loadProfile() {
    setLoading(true);
    try {
      // 1. Giriş yapan kullanıcıyı al
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // 2. Hedef Profil Bilgilerini Çek
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (profileError || !profileData) {
        console.error("Profil bulunamadı");
        setProfile(null);
      } else {
        setProfile(profileData);
      }

      // 3. Kullanıcının Tahminlerini Çek (Maç bilgileriyle join yaparak)
      const { data: preds, error: predsError } = await supabase
        .from('predictions')
        .select(`
          *,
          matches:match_id (*)
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (!predsError) setPredictions(preds || []);

      // 4. Takip Durumu Kontrolü
      if (user && user.id !== targetUserId) {
        const { data: follow } = await supabase
          .from('followers')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle();
        setIsFollowing(!!follow);
      }
    } catch (err) {
      console.error("Yükleme hatası:", err);
    } finally {
      setLoading(false);
    }
  }

  const toggleFollow = async () => {
    if (!currentUserId) return alert("Takip etmek için giriş yapmalısın!");
    if (currentUserId === targetUserId) return;
    
    if (isFollowing) {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);
      
      if (!error) setIsFollowing(false);
    } else {
      const { error } = await supabase
        .from('followers')
        .insert({ follower_id: currentUserId, following_id: targetUserId });
      
      if (!error) setIsFollowing(true);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black italic animate-pulse uppercase tracking-widest">
      STADYUM YÜKLENİYOR...
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-10">
      <h1 className="text-4xl font-black mb-4">404</h1>
      <p className="text-gray-500 uppercase tracking-widest mb-8 text-center">Bu oyuncu kadro dışı kalmış veya hiç var olmamış.</p>
      <Link href="/leaderboard" className="bg-blue-600 px-8 py-4 rounded-2xl font-black text-xs uppercase">Sıralamaya Dön</Link>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <Link href="/leaderboard" className="text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] mb-10 inline-block hover:text-white transition-all">
          ← SIRALAMAYA DÖN
        </Link>

        {/* ÜST PROFİL KARTI */}
        <div className="bg-gradient-to-br from-blue-900 via-[#0a0a0a] to-black p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden mb-12 transition-all hover:border-blue-500/20">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            {/* Profil Resmi */}
            <div className="w-36 h-36 rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-gray-900">
              <img 
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username}&background=random`} 
                className="w-full h-full object-cover" 
                alt="avatar"
              />
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                <h1 className="text-4xl font-black italic tracking-tighter uppercase">{profile?.username}</h1>
                <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase border border-blue-500/20">
                  {profile?.total_points || 0} PTS
                </div>
              </div>
              
              <p className="text-gray-400 text-sm italic mb-8 max-w-lg leading-relaxed">
                {profile?.bio || "Bu elit oyuncu henüz bir biyografi eklememiş."}
              </p>
              
              {/* Aksiyon Butonu */}
              {currentUserId === targetUserId ? (
                <Link href="/profile" className="bg-white/10 hover:bg-white/20 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all inline-block text-center">
                  Profilimi Düzenle ⚙️
                </Link>
              ) : (
                <button 
                  onClick={toggleFollow}
                  className={`px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all transform active:scale-95 shadow-xl ${
                    isFollowing 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' 
                      : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'
                  }`}
                >
                  {isFollowing ? 'TAKİBİ BIRAK' : 'TAKİP ET'}
                </button>
              )}
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* TAHMİN GEÇMİŞİ */}
        <div className="space-y-6">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.4em] mb-8 ml-4 italic">Oyuncu Tahmin Geçmişi</h2>
          
          {predictions.map((p) => (
            <div key={p.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:bg-white/[0.04]">
              {/* Maç Bilgisi */}
              <div className="flex items-center gap-6 flex-1">
                <div className="flex -space-x-2">
                  <img src={p.matches?.home_logo} className="w-10 h-10 object-contain bg-black/40 p-2 rounded-full border border-white/10" />
                  <img src={p.matches?.away_logo} className="w-10 h-10 object-contain bg-black/40 p-2 rounded-full border border-white/10" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">
                    {p.matches?.home_team} vs {p.matches?.away_team}
                  </span>
                  <span className="text-[9px] font-bold text-gray-600 uppercase">
                    {p.matches?.match_time ? new Date(p.matches.match_time).toLocaleDateString('tr-TR') : 'Tarih Belirsiz'}
                  </span>
                </div>
              </div>

              {/* Tahmin Kartı */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center bg-black/40 px-6 py-3 rounded-2xl border border-white/5 min-w-[130px]">
                  <span className="text-[7px] font-black text-blue-500 uppercase mb-1 opacity-60 tracking-widest">KAZANAN</span>
                  <span className="text-[10px] font-black italic uppercase">
                    {p.predicted_winner === 'HOME_TEAM' ? p.matches?.home_team : p.predicted_winner === 'AWAY_TEAM' ? p.matches?.away_team : 'BERABERLİK'}
                  </span>
                </div>
                
                <div className="flex flex-col items-center bg-amber-500/5 px-6 py-3 rounded-2xl border border-amber-500/10 min-w-[130px]">
                  <span className="text-[7px] font-black text-amber-500 uppercase mb-1 opacity-60 tracking-widest">MAÇIN ADAMI</span>
                  <span className="text-[10px] font-black italic text-amber-400 uppercase">🌟 {p.predicted_mvp}</span>
                </div>
              </div>

              {/* Puan Sonucu */}
              <div className="min-w-[80px] text-right">
                {p.is_processed ? (
                  <div className="flex flex-col items-end">
                    <span className={`text-2xl font-black italic ${p.points_earned > 0 ? 'text-emerald-500' : 'text-gray-700'}`}>
                      +{p.points_earned}
                    </span>
                    <span className="text-[8px] font-black uppercase text-gray-600 tracking-tighter">ELİTE PUAN</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-black text-orange-500/40 uppercase italic tracking-widest bg-orange-500/5 px-3 py-1 rounded-full border border-orange-500/10">İşleniyor</span>
                )}
              </div>
            </div>
          ))}

          {predictions.length === 0 && (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
              <p className="text-gray-600 font-bold italic uppercase text-xs tracking-widest">Bu oyuncu henüz hiçbir sahaya inmedi.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}