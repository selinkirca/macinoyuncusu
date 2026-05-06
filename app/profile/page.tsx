"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sosyal Modallar & Listeler
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);

  // Profil Düzenleme & Yükleme
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newBio, setNewBio] = useState("");
  const [uploading, setUploading] = useState(false);

  // Tahmin Güncelleme State'leri
  const [editMatch, setEditMatch] = useState<any>(null);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [mvpName, setMvpName] = useState("");

  useEffect(() => {
    getProfileData();
  }, []);

  async function getProfileData() {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { window.location.href = '/login'; return; }
    setUser(currentUser);

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    setProfile(profileData);
    setNewUsername(profileData?.username || "");
    setNewBio(profileData?.bio || "");

    const { data: preds } = await supabase.from('predictions').select(`*, matches (*)`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
    setPredictions(preds || []);

    // Takipçiler ve Takip Edilenler Çekimi
    const { data: following } = await supabase.from('followers').select(`following_id, profiles!followers_following_id_fkey(username, avatar_url)`).eq('follower_id', currentUser.id);
    const { data: followers } = await supabase.from('followers').select(`follower_id, profiles!followers_follower_id_fkey(username, avatar_url)`).eq('following_id', currentUser.id);

    setFollowingList(following || []);
    setFollowersList(followers || []);
    setLoading(false);
  }

  // --- RESİM SIKIŞTIRMA (WEB P & CANVAS) ---
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob as Blob), 'image/webp', 0.7);
        };
      };
    });
  };

  const handleFileUpload = async (event: any) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const compressedFile = await compressImage(file);
      const fileName = `${user.id}-${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedFile, { contentType: 'image/webp' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      
      setProfile({ ...profile, avatar_url: publicUrl });
      alert("Fotoğraf optimize edilerek yüklendi! ✅");
    } catch (error: any) {
      alert("Yükleme Hatası: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async () => {
    const { error } = await supabase.from('profiles').upsert({ id: user.id, username: newUsername, bio: newBio });
    if (error) alert(error.message);
    else { alert("Başarılı! ✨"); setIsEditingProfile(false); getProfileData(); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black italic animate-pulse">MAÇIN YILDIZI...</div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] mb-10 inline-block">← GERİ DÖN</Link>

        {/* PROFIL KARTI */}
        <div className="bg-gradient-to-br from-blue-900 via-black to-black p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden mb-12">
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            
            {/* Fotoğraf Değiştirme */}
            <div className="relative group">
              <div className="w-36 h-36 rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl bg-gray-900">
                <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username}`} className="w-full h-full object-cover" />
              </div>
              <label className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-all rounded-[2.5rem] text-[9px] font-black tracking-widest">
                {uploading ? "YÜKLENİYOR..." : "FOTOĞRAF SEÇ"}
                <input type="file" hidden accept="image/*" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-black italic tracking-tighter mb-2 uppercase">{profile?.username}</h1>
              <p className="text-gray-500 text-xs mb-8 italic max-w-md">{profile?.bio || "Henüz bir biyografi yazılmadı."}</p>
              
              <div className="flex justify-center md:justify-start gap-10 border-t border-white/5 pt-8">
                <button onClick={() => setShowFollowers(true)} className="flex flex-col items-center md:items-start group transition-transform active:scale-95">
                  <span className="text-2xl font-black group-hover:text-blue-500">{followersList.length}</span>
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Takipçi</span>
                </button>
                <button onClick={() => setShowFollowing(true)} className="flex flex-col items-center md:items-start group transition-transform active:scale-95">
                  <span className="text-2xl font-black group-hover:text-blue-500">{followingList.length}</span>
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Takip</span>
                </button>
                <div className="flex flex-col items-center md:items-start">
                  <span className="text-2xl font-black text-emerald-500 italic">+{predictions.reduce((s, p) => s + (p.points_earned || 0), 0)}</span>
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest text-center md:text-left">Kariyer Puanı</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setIsEditingProfile(true)} className="absolute top-8 right-8 bg-white/5 hover:bg-white/10 p-3 rounded-2xl border border-white/10 transition-all">⚙️</button>
        </div>

        {/* SOSYAL MODALLAR */}
        {(showFollowers || showFollowing) && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl z-[200] flex items-center justify-center p-4">
            <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-sm rounded-[3rem] p-10 relative">
              <h3 className="text-xl font-black italic uppercase mb-8 text-blue-500">{showFollowers ? "Takipçiler" : "Takip Ettiklerin"}</h3>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {(showFollowers ? followersList : followingList).map((item: any, i: number) => {
                  const p = showFollowers ? item.profiles : item.profiles;
                  return (
                    <div key={i} className="flex items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                      <img src={p?.avatar_url || `https://ui-avatars.com/api/?name=${p?.username}`} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                      <span className="font-black text-sm uppercase italic">{p?.username}</span>
                    </div>
                  );
                })}
                {(showFollowers ? followersList : followingList).length === 0 && <p className="text-gray-600 text-xs text-center italic">Liste boş.</p>}
              </div>
              <button onClick={() => {setShowFollowers(false); setShowFollowing(false)}} className="w-full mt-8 text-gray-500 text-[10px] font-black uppercase tracking-widest">Kapat</button>
            </div>
          </div>
        )}

        {/* PROFIL DÜZENLEME MODALI */}
        {isEditingProfile && (
          <div className="fixed inset-0 bg-black/95 z-[210] flex items-center justify-center p-4">
            <div className="bg-[#0f0f0f] border border-white/10 p-10 rounded-[3.5rem] max-w-md w-full">
              <h3 className="text-xl font-black text-center mb-8 uppercase italic">Profili Düzenle</h3>
              <div className="space-y-5">
                <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full bg-black border border-white/10 p-5 rounded-2xl text-sm font-bold outline-none focus:border-blue-500" />
                <textarea placeholder="Biyografi" value={newBio} onChange={(e) => setNewBio(e.target.value)} className="w-full bg-black border border-white/10 p-5 rounded-2xl text-sm font-bold h-32 outline-none focus:border-blue-500" />
                <button onClick={handleUpdateProfile} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-xs shadow-lg shadow-blue-600/20">Değişiklikleri Kaydet</button>
                <button onClick={() => setIsEditingProfile(false)} className="w-full text-gray-500 text-[10px] font-black uppercase">Vazgeç</button>
              </div>
            </div>
          </div>
        )}

        {/* TAHMİNLER LİSTESİ */}
        <div className="grid gap-4 opacity-90">
          {predictions.map((p) => (
            <div key={p.id} className="bg-white/5 p-5 rounded-[2rem] flex items-center justify-between border border-white/5 hover:bg-white/[0.08] transition-all group">
              
              {/* SOL ALAN: MAÇ VE SKOR */}
              <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-3 bg-black/20 px-4 py-2 rounded-2xl border border-white/5">
                  {/* Ev Sahibi */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase hidden md:block">
                      {p.matches.home_team}
                    </span>
                    <img src={p.matches.home_logo} className="w-6 h-6 object-contain" alt="home" />
                  </div>

                  {/* YAN YANA SKOR */}
                  <div className="flex items-center gap-2 px-2 border-x border-white/10">
                    <span className="text-sm font-black tabular-nums text-blue-500 italic">
                      {p.matches.home_score ?? 0}
                    </span>
                    <span className="text-gray-600 text-[10px]">-</span>
                    <span className="text-sm font-black tabular-nums text-blue-500 italic">
                      {p.matches.away_score ?? 0}
                    </span>
                  </div>

                  {/* Deplasman */}
                  <div className="flex items-center gap-2">
                    <img src={p.matches.away_logo} className="w-6 h-6 object-contain" alt="away" />
                    <span className="text-[10px] font-black text-gray-400 uppercase hidden md:block">
                      {p.matches.away_team}
                    </span>
                  </div>
                </div>
              </div>

              {/* SAĞ ALAN: TAHMİN VE PUAN */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[11px] font-black italic text-white uppercase tracking-tighter">
                    Tahmin: <span className="text-blue-500">{p.predicted_winner === 'HOME_TEAM' ? '1' : p.predicted_winner === 'DRAW' ? 'X' : '2'}</span> 
                    <span className="mx-2 text-gray-700">|</span> 
                    🌟 {p.predicted_mvp}
                  </div>
                  <div className={`text-[10px] font-bold mt-0.5 ${p.points_earned > 0 ? 'text-emerald-500' : 'text-gray-500'}`}>
                    {p.points_earned > 0 ? `+${p.points_earned} PUAN KAZANILDI` : 'BEKLENİYOR / 0 PUAN'}
                  </div>
                </div>
              </div>

            </div>
          ))}

          {predictions.length === 0 && (
            <div className="text-center py-20 text-gray-700 font-black text-[10px] uppercase tracking-widest border border-dashed border-white/5 rounded-[3rem]">
              Henüz bir tahmin bulunmuyor
            </div>
          )}
        </div>
      </div>
    </main>
  );
}