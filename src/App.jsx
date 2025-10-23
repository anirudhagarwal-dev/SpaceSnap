import React, { useState, useEffect, createContext, useContext, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate } from "react-router-dom";
import "./App.css";
import headerBg from './spacesanpimage1.jpg';

const API_BASE = "https://images-api.nasa.gov";

const AppContext = createContext(null);

function AppProvider({ children }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalHits, setTotalHits] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/search?q=nebula&page=1&media_type=image`)
      .then(r => r.json())
      .then(data => {
        const arr = (data.collection && data.collection.items) || [];
        setItems(arr);
        setTotalHits((data.collection && data.collection.metadata && data.collection.metadata.total_hits) || arr.length);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load images");
        setLoading(false);
      });
  }, []);

  const value = { query, setQuery, items, setItems, page, setPage, loading, setLoading, error, setError, totalHits, setTotalHits };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function useApp() { return useContext(AppContext); }

function SearchBar() {
  const { query, setQuery, setPage, setItems, setLoading, setError, setTotalHits } = useApp();
  const [local, setLocal] = useState(query);
  const timer = useRef(null);

  useEffect(() => { setLocal(query); }, [query]);

  function doSearch(q, p = 1) {
    if (!q) return;
    setLoading(true);
    fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&page=${p}&media_type=image`)
      .then(r => r.json())
      .then(data => {
        const arr = (data.collection && data.collection.items) || [];
        setItems(arr);
        setPage(p);
        setTotalHits((data.collection && data.collection.metadata && data.collection.metadata.total_hits) || arr.length);
        setLoading(false);
        setError("");
      })
      .catch(() => {
        setError("Search failed. Try again.");
        setLoading(false);
      });
  }

  function onChange(e) {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setQuery(v);
      if (v.trim()) doSearch(v.trim(), 1);
    }, 600);
  }

  function onSubmit(e) {
    e.preventDefault();
    clearTimeout(timer.current);
    setQuery(local);
    if (local.trim()) doSearch(local.trim(), 1);
  }

  return (
    <form onSubmit={onSubmit} className="search-bar">
      <input value={local} onChange={onChange} placeholder="Search SPACE images (e.g. moon, mars, earth)" className="search-input" />
      <button className="search-btn">Search</button>
    </form>
  );
}

function ImageCard({ item }) {
  const data = item.data && item.data[0];
  const link = (item.links && item.links[0] && item.links[0].href) || "";
  const title = data && data.title;
  const date = data && (data.date_created || data.date);
  const id = data && data.nasa_id;

  return (
    <Link to={`/detail/${encodeURIComponent(id)}`} className="image-card">
      <div className="card-inner">
        <div className="card-front">
          <img src={link} alt={title} />
        </div>
        <div className="card-back">
          <h3>{title}</h3>
          <p>{date ? new Date(date).toLocaleDateString() : "Unknown"}</p>
        </div>
      </div>
    </Link>
  );
}

function Home() {
  const { items, loading, error, page, setPage, setItems, totalHits, setTotalHits, query } = useApp();
  const [localPage, setLocalPage] = useState(page || 1);

  useEffect(() => { setLocalPage(page); }, [page]);

  function changePage(p) {
    setLocalPage(p);
    setPage(p);
    const q = query || "nebula";
    fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}&page=${p}&media_type=image`)
      .then(r => r.json())
      .then(data => {
        const arr = (data.collection && data.collection.items) || [];
        setItems(arr);
        setTotalHits((data.collection && data.collection.metadata && data.collection.metadata.total_hits) || arr.length);
      })
      .catch(() => {});
  }

  const pages = Math.max(1, Math.ceil((totalHits || items.length) / 12));

  return (
    <div className="home">
      <SearchBar />
      {error && <div className="error-text">{error}</div>}
      {loading && <div className="loading">Loading...</div>}
      {!loading && items.length === 0 && <div className="no-images">No images found</div>}
      <div className="grid-container">
        {items.map((it, i) => <ImageCard key={i} item={it} />)}
      </div>
      <div className="pagination">
        <button disabled={localPage<=1} onClick={() => changePage(localPage-1)}>Prev</button>
        <span>Page {localPage} / {pages}</span>
        <button disabled={localPage>=pages} onClick={() => changePage(localPage+1)}>Next</button>
      </div>
    </div>
  );
}

function DetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API_BASE}/search?nasa_id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => {
        const item = (d.collection && d.collection.items && d.collection.items[0]) || null;
        setMeta(item && item.data && item.data[0]);
        return fetch(`${API_BASE}/asset/${encodeURIComponent(id)}`);
      })
      .then(r => r.json())
      .then(a => {
        setAssets((a.collection && a.collection.items) || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load details");
        setLoading(false);
      });
  }, [id]);

  function downloadBest() {
    const jpg = assets.slice().reverse().find(it => (it.href && it.href.match(/\.jpg|\.png|\.jpeg/)));
    const url = (jpg && jpg.href) || (assets[0] && assets[0].href);
    if (!url) return alert("No downloadable file found");
    fetch(url)
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${meta && meta.nasa_id}.jpg`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(() => alert("Download failed"));
  }

  return (
    <div className="detail">
      <div className="detail-header">
        <button onClick={() => navigate(-1)}>Back</button>
        <h2>{meta && meta.title}</h2>
      </div>
      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error-text">{error}</div>}
      {!loading && meta && (
        <div className="detail-grid">
          <div className="detail-img">
            <img src={(assets && assets[0] && assets[0].href) || (meta && meta.thumbnail)} alt={meta.title} />
            <div className="download-btns">
              <button onClick={downloadBest}>Download</button>
              <a href={(assets && assets[0] && assets[0].href) || "#"} target="_blank" rel="noreferrer">Open raw</a>
            </div>
          </div>
          <div className="detail-info">
            <p className="date">{meta && new Date(meta.date_created).toLocaleString()}</p>
            <p>{meta && (meta.description || meta.description_508 || "No description available.")}</p>
            <p>Center: {meta && meta.center}</p>
            <p>Keywords: {meta && (meta.keywords && meta.keywords.join(", ") || "—")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="app-container">
          <header 
               className="header"
                style={{
                 backgroundImage: `url(${headerBg})`,
                 backgroundSize: 'cover',
                 backgroundPosition: 'center',
                 backgroundRepeat: 'no-repeat',
                       }}
 >
  <Link to="/" className="logo">SpaceSnap</Link>
    </header>

          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/detail/:id" element={<DetailView />} />
            </Routes>
          </main>
          <footer className="footer">SpaceSnap returning with Memories</footer>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

const style = document.createElement("style");
style.textContent = `
body {
  font-family: 'Poppins', Arial, sans-serif;
  margin: 0;
  background: linear-gradient(180deg, #0b1220 0%, #152c55 100%);
  color: #f5f5f5;
  min-height: 100vh;
}
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.header {
  background-image: url('spacesanpimage1.jpg');
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.logo {
  font-size: 1.6rem;
  font-weight: bold;
  text-decoration: none;
  color: #ffffff;
  letter-spacing: 1px;
}
.logo span {
  color: #90bdf0ff;
}
.search-bar {
  display: flex;
  gap: 0.6rem;
  max-width: 600px;
  margin: 1.5rem auto;
}
.search-input {
  flex: 1;
  padding: 0.7rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #e5e5e5;
  outline: none;
  transition: all 0.3s ease;
}
.search-input:focus {
  border-color: #58a6ff;
  box-shadow: 0 0 6px #58a6ff;
}
.search-btn {
  padding: 0.7rem 1.2rem;
  background: linear-gradient(90deg, #58a6ff, #00c2cb);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: 0.3s;
}
.search-btn:hover {
  opacity: 0.9;
  transform: scale(1.03);
}
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 100vw;
  margin: 0 auto;
}
.image-card {
  perspective: 1000px;
  display: block;
  border-radius: 0.6rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.image-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(88, 166, 255, 0.3);
}
.card-inner {
  position: relative;
  width: 100%;
  height: 200px;
  transform-style: preserve-3d;
  transition: transform 0.6s;
}
.image-card:hover .card-inner {
  transform: rotateY(180deg);
}
.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 0.6rem;
  overflow: hidden;
}
.card-front img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-back {
  background: linear-gradient(180deg, #549ee8ff 0%, #171026ff 100%);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotateY(180deg);
  padding: 0.8rem;
  text-align: center;
}
.card-back h4 {
  font-size: 0.95rem;
  margin: 0;
}
.card-back p {
  font-size: 0.8rem;
  color: #9ca3af;
  margin-top: 0.3rem;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
}
.pagination button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background: linear-gradient(90deg, #58a6ff, #00c2cb);
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: 0.3s;
}
.pagination button:disabled {
  opacity: 0.4;
  cursor: default;
}
.pagination button:hover:not(:disabled) {
  transform: scale(1.05);
}
.detail {
  max-width: 950px;
  margin: 2rem auto;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 1rem;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.2rem;
}
.detail-header button {
  padding: 0.4rem 0.8rem;
  background: #374151;
  border: none;
  border-radius: 0.4rem;
  color: white;
  cursor: pointer;
  transition: 0.3s;
}
.detail-header button:hover {
  background: #4b5563;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
.detail-img img {
  width: 100%;
  border-radius: 0.8rem;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
}
.download-btns {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.8rem;
}
.download-btns button,
.download-btns a {
  padding: 0.5rem 0.9rem;
  border-radius: 0.4rem;
  background: linear-gradient(90deg, #58a6ff, #00c2cb);
  border: none;
  color: white;
  text-decoration: none;
  cursor: pointer;
  transition: 0.3s;
}
.download-btns button:hover,
.download-btns a:hover {
  opacity: 0.85;
}
.detail-info p {
  margin: 0.4rem 0;
  color: #e5e7eb;
  line-height: 1.4;
}
.footer {
  margin-top: auto;
  text-align: center;
  padding: 1rem;
  font-size: 0.9rem;
  color: #9ca3af;
  background: rgba(255, 255, 255, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.error-text {
  color: #ff6b6b;
  text-align: center;
  font-weight: 500;
  margin-top: 0.5rem;
}
.loading {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
  margin-top: 1rem;
}
`;
document.head.appendChild(style);