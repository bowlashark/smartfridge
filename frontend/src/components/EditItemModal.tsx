import { useRef, useState } from 'react';
import { updateInventory } from '../api/client';
import type { InventoryItem } from '../api/types';
import { overlay, modalStyle, cancelBtn, saveBtn, inputStyle } from '../pages/DashboardPage';
import PhotoActionSheet from './PhotoActionSheet';

interface Props {
  item: InventoryItem & { categoryName?: string };
  onClose: () => void;
  onUpdated: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  蔬菜:'🥬', 水果:'🍎', 肉類:'🥩', 乳製品:'🧀', 飲料:'🥤',
  調味料:'🧂', 冷凍食品:'🧊', 其他:'📦',
  Vegetables:'🥬', Fruits:'🍎', Meat:'🥩', Dairy:'🧀',
  Beverages:'🥤', Condiments:'🧂', Frozen:'🧊', Others:'📦',
  Eggs:'🥚', Seafood:'🐟', Staples:'🌾',
};

export default function EditItemModal({ item, onClose, onUpdated }: Props) {
  const parsedDate = item.expire_date.split('-');
  const [quantity, setQuantity] = useState(item.quantity);
  const [dateFields, setDateFields] = useState({
    year: parsedDate[0] ?? '',
    month: String(Number(parsedDate[1] ?? '')),
    day:   String(Number(parsedDate[2] ?? '')),
  });
  const [expiry, setExpiry] = useState(item.expire_date);
  const [productImg, setProductImg]           = useState<string | null>(null);
  const [showProductSheet, setShowProductSheet] = useState(false);
  const productFileRef   = useRef<HTMLInputElement>(null);
  const productCameraRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleProductFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setProductImg(e.target!.result as string);
    reader.readAsDataURL(file);
  };

  const updateExpiry = (fields: { year: string; month: string; day: string }) => {
    const { year, month, day } = fields;
    if (year && month && day)
      setExpiry(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`);
  };

  const handleSave = async () => {
    setError(''); setSaving(true);
    try {
      await updateInventory(item.inventory_id, {
        quantity: Math.max(1, quantity),
        expire_date: expiry,
        custom_expire: true,
      });
      onUpdated(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '更新失敗');
    } finally { setSaving(false); }
  };

  const catName = item.categoryName ?? '';

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalStyle, maxHeight:'92vh', overflowY:'auto', padding:20 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text)', margin:'0 0 16px' }}>✏️ 編輯食材</h2>

        {/* ── 商品照片（可重拍） + 有效期限（裝飾） ── */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <div onClick={() => setShowProductSheet(true)}
            style={{ flex:1, aspectRatio:'1/1', borderRadius:14, background: productImg ? 'transparent' : '#f8fafc', border:`2px dashed ${productImg ? 'transparent' : '#cbd5e1'}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', position:'relative', overflow:'hidden' }}>
            {productImg ? (
              <>
                <img src={productImg} alt="product" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:12 }} />
                <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.3)', borderRadius:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
                  <span style={{ fontSize:20 }}>📷</span>
                  <span style={{ color:'#fff', fontSize:11, fontWeight:600 }}>重新拍照</span>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize:28 }}>📷</span>
                <span style={{ fontWeight:600, color:'#64748b', fontSize:12 }}>商品照片</span>
                <span style={{ fontSize:11, color:'#94a3b8' }}>點擊拍照</span>
              </>
            )}
          </div>
          <input ref={productFileRef}   type="file" accept="image/*" style={{ display:'none' }} onChange={e => { handleProductFile(e.target.files?.[0] ?? null); e.target.value=''; }} />
          <input ref={productCameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => { handleProductFile(e.target.files?.[0] ?? null); e.target.value=''; }} />

          <div style={{ flex:1, aspectRatio:'1/1', borderRadius:14, background:'#f8fafc', border:'2px dashed #cbd5e1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
            <span style={{ fontSize:28 }}>📅</span>
            <span style={{ fontWeight:600, color:'#64748b', fontSize:12 }}>有效期限</span>
            <span style={{ fontSize:11, color:'#94a3b8' }}>對照下方日期填寫</span>
          </div>
        </div>

        {/* ── 食材名稱（唯讀） ── */}
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>食材名稱</label>
          <div style={{ ...inputStyle, display:'flex', alignItems:'center', gap:8, color:'var(--text)', opacity:0.8, cursor:'default' }}>
            <span>{CATEGORY_ICONS[catName] ?? '📦'}</span>
            <span>{item.ingredient_name ?? `食材 #${item.ingredient_id}`}</span>
          </div>
        </div>

        {/* ── 分類（唯讀） ── */}
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>分類</label>
          <div style={{ ...inputStyle, color:'var(--text)', opacity:0.8, cursor:'default' }}>
            {catName || '未分類'}
          </div>
        </div>

        {/* ── 數量 +/- ── */}
        <div style={{ marginBottom:10 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>數量</label>
          <div style={{ display:'flex', alignItems:'center', gap:0, background:'var(--surface-2)', borderRadius:10, border:'1.5px solid var(--border)', width:'fit-content', overflow:'hidden' }}>
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
              style={{ width:40, height:40, border:'none', background:'none', fontSize:20, color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <span style={{ minWidth:36, textAlign:'center', fontWeight:700, fontSize:16, color:'var(--text)' }}>{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)}
              style={{ width:40, height:40, border:'none', background:'none', fontSize:20, color:'var(--text-2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>＋</button>
          </div>
        </div>

        {/* ── 到期日 ── */}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:5 }}>到期日</label>
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
            {saving ? '儲存中…' : '儲存變更'}
          </button>
        </div>
      </div>

      {showProductSheet && (
        <PhotoActionSheet
          onGallery={() => { setShowProductSheet(false); productFileRef.current?.click(); }}
          onCamera={() => { setShowProductSheet(false); productCameraRef.current?.click(); }}
          onClose={() => setShowProductSheet(false)}
        />
      )}
    </div>
  );
}
