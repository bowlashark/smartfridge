import { useEffect, useRef, useState } from 'react';
import { getCategories, getIngredients, createInventory, createIngredient } from '../api/client';
import type { Category, Ingredient } from '../api/types';
import { overlay, modalStyle, cancelBtn, saveBtn, inputStyle } from '../pages/DashboardPage';
import PhotoActionSheet from './PhotoActionSheet';

interface Props {
  userId: string;
  onClose: () => void;
  onAdded: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  蔬菜:'🥬', 水果:'🍎', 肉類:'🥩', 乳製品:'🧀', 飲料:'🥤',
  調味料:'🧂', 冷凍食品:'🧊', 其他:'📦',
  Vegetables:'🥬', Fruits:'🍎', Meat:'🥩', Dairy:'🧀',
  Beverages:'🥤', Condiments:'🧂', Frozen:'🧊', Others:'📦',
  Eggs:'🥚', Seafood:'🐟', Staples:'🌾', Drinks:'🥤',
};

export default function AddItemModal({ userId, onClose, onAdded }: Props) {
  const [categories, setCategories]     = useState<Category[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [suggestions, setSuggestions]   = useState<Ingredient[]>([]);
  const [selectedIng, setSelectedIng]   = useState<Ingredient | null>(null);
  const today = new Date();
  const todayStr = { year: String(today.getFullYear()), month: String(today.getMonth()+1), day: String(today.getDate()) };
  const todayIso = `${todayStr.year}-${todayStr.month.padStart(2,'0')}-${todayStr.day.padStart(2,'0')}`;
  const [form, setForm] = useState({ name: '', category: '', quantity: 1, expiry: todayIso });
  const [dateFields, setDateFields]     = useState(todayStr);
  const [productImg, setProductImg]     = useState<string | null>(null);
  const [expiryImg, setExpiryImg]       = useState<string | null>(null);
  const [recognizing, setRecognizing]   = useState(false);
  const [recognizeErr, setRecognizeErr] = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [showProductSheet, setShowProductSheet] = useState(false);
  const [showExpirySheet, setShowExpirySheet]   = useState(false);
  const skipSugRef = useRef(false);
  const productFileRef    = useRef<HTMLInputElement>(null);
  const productCameraRef  = useRef<HTMLInputElement>(null);
  const expiryFileRef     = useRef<HTMLInputElement>(null);
  const expiryCameraRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    getIngredients().then(all => { setAllIngredients(all); setSuggestions(all); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (skipSugRef.current) { skipSugRef.current = false; return; }
    if (!form.name.trim()) { setSuggestions(allIngredients); setSelectedIng(null); return; }
    setSuggestions(allIngredients.filter(i => i.name.toLowerCase().includes(form.name.toLowerCase())));
    setSelectedIng(null);
  }, [form.name, allIngredients]);

  const selectIngredient = (ing: Ingredient) => {
    skipSugRef.current = true;
    setSelectedIng(ing);
    setForm(f => ({ ...f, name: ing.name }));
  };

  const updateExpiry = (fields: { year: string; month: string; day: string }) => {
    const { year, month, day } = fields;
    const expiry = year && month && day
      ? `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
      : '';
    setForm(f => ({ ...f, expiry }));
  };

  const handleProductFile = async (file: File | null) => {
    if (!file) return;
    setRecognizeErr('');
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target!.result as string;
      setProductImg(dataUrl);
      const base64 = dataUrl.split(',')[1];
      setRecognizing(true);
      try {
        const res = await fetch('https://smartfridge-f6b6.onrender.com/api/v1/system/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 }),
        });
        const data = await res.json();
        if (data.status === 'success' && data.data?.label) {
          skipSugRef.current = true;
          setForm(f => ({ ...f, name: data.data.label }));
          setSuggestions(allIngredients.filter(i => i.name.toLowerCase().includes(data.data.label.toLowerCase())));
          const match = allIngredients.find(i => i.name.toLowerCase().includes(data.data.label.toLowerCase()));
          if (match) setSelectedIng(match);
        } else {
          setRecognizeErr('辨識失敗，請手動輸入');
        }
      } catch {
        setRecognizeErr('辨識失敗，請手動輸入');
      }
      setRecognizing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleExpiryFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setExpiryImg(e.target!.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.expiry) { setError('請選擇到期日'); return; }
    setError(''); setSaving(true);
    try {
      const name = form.name.trim() || 'nothing';
      let ing = selectedIng
        ?? allIngredients.find(i => i.name.toLowerCase() === name.toLowerCase())
        ?? allIngredients.find(i => i.name.toLowerCase().includes(name.toLowerCase()))
        ?? (name
          ? await createIngredient({ name, category_id: categories.find(c => c.category_name === form.category)?.category_id }).catch(() => null)
          : null)
        ?? null;
      if (!ing) { setError('請先輸入食材名稱'); setSaving(false); return; }
      await createInventory({
        user_id: userId,
        ingredient_id: ing.ingredient_id,
        quantity: Math.max(1, form.quantity),
        expire_date: form.expiry,
        custom_expire: true,
      });
      onAdded(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '新增失敗');
    } finally { setSaving(false); }
  };

  const photoTile = (_label: string, img: string | null, _loading: boolean, _onClick: () => void): React.CSSProperties => ({
    flex: 1, aspectRatio: '1/1', borderRadius: 14,
    background: img ? 'transparent' : '#f8fafc',
    border: `2px dashed ${img ? 'transparent' : '#cbd5e1'}`,
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, fontSize: 12, color: '#94a3b8',
  });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalStyle, maxHeight:'92vh', overflowY:'auto', padding:20 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)', margin:'0 0 16px' }}>＋ 新增食材</h2>

        {/* ── 兩個拍照格 ── */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          {/* 商品照片 */}
          <div style={photoTile('商品照片', productImg, recognizing, () => {})}
            onClick={() => setShowProductSheet(true)}>
            {productImg ? (
              <>
                <img src={productImg} alt="product" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:12 }} />
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.3)', borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
                  {recognizing
                    ? <div style={{ width:20, height:20, border:'3px solid #fff', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                    : <span style={{ fontSize:20 }}>📷</span>}
                  <span style={{ color:'#fff', fontSize:11, fontWeight:600 }}>{recognizing ? '辨識中…' : '重新拍照'}</span>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize:28 }}>📷</span>
                <span style={{ fontWeight:600, color:'#64748b', fontSize:12 }}>商品照片</span>
                <span style={{ fontSize:11 }}>拍照自動辨識名稱</span>
              </>
            )}
          </div>
          <input ref={productFileRef}   type="file" accept="image/*" style={{ display:'none' }} onChange={e => { handleProductFile(e.target.files?.[0] ?? null); e.target.value=''; }} />
          <input ref={productCameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { handleProductFile(e.target.files?.[0] ?? null); e.target.value=''; }} />

          {/* 有效期限照片 */}
          <div style={photoTile('有效期限', expiryImg, false, () => {})}
            onClick={() => setShowExpirySheet(true)}>
            {expiryImg ? (
              <>
                <img src={expiryImg} alt="expiry" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:12 }} />
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.25)', borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
                  <span style={{ fontSize:20 }}>📅</span>
                  <span style={{ color:'#fff', fontSize:11, fontWeight:600 }}>重新拍照</span>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize:28 }}>📅</span>
                <span style={{ fontWeight:600, color:'#64748b', fontSize:12 }}>有效期限</span>
                <span style={{ fontSize:11 }}>拍日期對照填寫</span>
              </>
            )}
          </div>
          <input ref={expiryFileRef}   type="file" accept="image/*" style={{ display:'none' }} onChange={e => { handleExpiryFile(e.target.files?.[0] ?? null); e.target.value=''; }} />
          <input ref={expiryCameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { handleExpiryFile(e.target.files?.[0] ?? null); e.target.value=''; }} />
        </div>

        {recognizeErr && <p style={{ color:'#f59e0b', fontSize:12, margin:'-8px 0 10px', display:'flex', alignItems:'center', gap:4 }}>⚠️ {recognizeErr}</p>}

        {/* ── 食材名稱 ── */}
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>食材名稱 *</label>
          <input style={inputStyle} placeholder="輸入關鍵字搜尋或手動輸入…" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>

        {/* 建議清單 */}
        {form.name && !selectedIng && suggestions.length > 0 && (
          <div style={{ border:'1.5px solid var(--border)', borderRadius:10, maxHeight:140, overflowY:'auto', marginBottom:10, background:'var(--surface)' }}>
            {suggestions.slice(0, 20).map(ing => {
              const catName = ing.category_id != null ? (categories.find(c => c.category_id === ing.category_id)?.category_name ?? '') : '';
              return (
                <button key={ing.ingredient_id} onClick={() => selectIngredient(ing)}
                  style={{ display:'flex', alignItems:'center', gap:8, width:'100%', padding:'8px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--text)' }}>
                  <span>{CATEGORY_ICONS[catName] ?? '📦'}</span>
                  <span>{ing.name}</span>
                  {ing.default_expire_days && <span style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8' }}>{ing.default_expire_days}天</span>}
                </button>
              );
            })}
          </div>
        )}

        {selectedIng && (
          <div style={{ background:'#f0f9ff', borderRadius:10, padding:'7px 12px', marginBottom:10, fontSize:13, color:'#0369a1', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>✅ 已選：<strong>{selectedIng.name}</strong></span>
            <button onClick={() => { setSelectedIng(null); setForm(f => ({ ...f, name:'' })); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>✕</button>
          </div>
        )}

        {/* ── 分類 ── */}
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>分類</label>
          <select style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            <option value="">全部分類</option>
            {categories.map(c => <option key={c.category_id} value={c.category_name}>{CATEGORY_ICONS[c.category_name] ?? '📦'} {c.category_name}</option>)}
          </select>
        </div>

        {/* ── 數量 +/- ── */}
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>數量</label>
          <div style={{ display:'flex', alignItems:'center', gap:0, background:'var(--surface-2)', borderRadius:10, border:'1.5px solid var(--border)', width:'fit-content', overflow:'hidden' }}>
            <button onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
              style={{ width:40, height:40, border:'none', background:'none', fontSize:20, color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <span style={{ minWidth:36, textAlign:'center', fontWeight:700, fontSize:16, color:'var(--text)' }}>{form.quantity}</span>
            <button onClick={() => setForm(f => ({ ...f, quantity: f.quantity + 1 }))}
              style={{ width:40, height:40, border:'none', background:'none', fontSize:20, color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>＋</button>
          </div>
        </div>

        {/* ── 到期日 ── */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>
            到期日 *
            {expiryImg && <span style={{ marginLeft:8, fontSize:11, color:'#0ea5e9', fontWeight:400 }}>↑ 對照右上照片填寫</span>}
          </label>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inputStyle, width:72, padding:'10px 10px' }} type="number" placeholder="年" min={2024} max={2099}
              value={dateFields.year}
              onChange={e => { const f = { ...dateFields, year: e.target.value }; setDateFields(f); updateExpiry(f); }} />
            <input style={{ ...inputStyle, width:52, padding:'10px 10px' }} type="number" placeholder="月" min={1} max={12}
              value={dateFields.month}
              onChange={e => { const f = { ...dateFields, month: e.target.value }; setDateFields(f); updateExpiry(f); }} />
            <input style={{ ...inputStyle, width:52, padding:'10px 10px' }} type="number" placeholder="日" min={1} max={31}
              value={dateFields.day}
              onChange={e => { const f = { ...dateFields, day: e.target.value }; setDateFields(f); updateExpiry(f); }} />
          </div>
        </div>

        {error && <p style={{ color:'#ef4444', fontSize:13, marginBottom:8 }}>{error}</p>}

        <div style={{ display:'flex', gap:10 }}>
          <button style={cancelBtn} onClick={onClose}>取消</button>
          <button style={{ ...saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? '新增中…' : '新增食材'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {showProductSheet && (
        <PhotoActionSheet
          onGallery={() => { setShowProductSheet(false); productFileRef.current?.click(); }}
          onCamera={() => { setShowProductSheet(false); productCameraRef.current?.click(); }}
          onClose={() => setShowProductSheet(false)}
        />
      )}
      {showExpirySheet && (
        <PhotoActionSheet
          onGallery={() => { setShowExpirySheet(false); expiryFileRef.current?.click(); }}
          onCamera={() => { setShowExpirySheet(false); expiryCameraRef.current?.click(); }}
          onClose={() => setShowExpirySheet(false)}
        />
      )}
    </div>
  );
}
