import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import cors from "cors";
import cron from "node-cron";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- KONFIGURASI ---
const app = express();
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- VARIABEL CACHE ---
let cachedGoldData = { status: "uninitialized", last_update: null, data: {} };
let cachedMarketSummary = { status: "uninitialized", last_update: null, data: {} };

// --- FUNGSI UTAMA ---

// Fungsi untuk melakukan scraping harga emas
const scrapeGoldPrice = async () => {
    console.log("Running gold price scrape job...");
    try {
        const url = "https://anekalogam.co.id/id";
        const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await response.text();
        const $ = cheerio.load(html);
        let data = {}, found = false;

        $("table.lm-table tbody tr").each((i, el) => {
            if (found) return;
            const cols = $(el).find("td");
            if (cols.length >= 3) {
                const gramasi = $(cols[0]).text().trim();
                if (gramasi.toLowerCase() === "1gram") {
                    data = {
                        gramasi,
                        hargaJual: $(cols[1]).text().replace(/[^0-9]/g, ''),
                        hargaBeli: $(cols[2]).text().replace(/[^0-9]/g, '')
                    };
                    found = true;
                }
            }
        });

        if (found) {
            cachedGoldData = { status: "success", source: url, last_update: new Date().toISOString(), data };
            console.log("Gold price scrape successful. Data updated:", data);
        } else {
            cachedGoldData = { status: "error", message: "Data 1 gram tidak ditemukan." };
        }
    } catch (err) {
        console.error("Error during scraping:", err);
        cachedGoldData = { status: "error", message: err.message };
    }
};

// Fungsi untuk mengambil ringkasan pasar dari Gemini
const fetchMarketSummary = async () => {
    console.log("Fetching market summary from AI...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = "Anda adalah seorang analis pasar keuangan di Indonesia. Berdasarkan berita-berita utama hari ini tentang ekonomi global dan Indonesia, berikan ringkasan singkat (maksimal 3 kalimat) mengenai sentimen pasar terhadap harga emas. Sertakan juga properti 'sentiment' (Positif/Negatif/Netral) dan 'recommendation' ('Beli'/'Jual'/'Tahan'). Jawab dalam format JSON.";
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonData = JSON.parse(text);
        cachedMarketSummary = { status: "success", last_update: new Date().toISOString(), data: jsonData };
        console.log("Market summary fetched successfully:", jsonData);

    } catch (error) {
        console.error("Error fetching market summary:", error);
        cachedMarketSummary = { status: "error", message: "Gagal mengambil ringkasan pasar dari AI." };
    }
};


// --- JADWAL OTOMATIS (CRON JOBS) ---
// Jadwalkan scraping harga emas setiap jam 3 pagi
cron.schedule('0 3 * * *', scrapeGoldPrice, { timezone: "Asia/Jakarta" });
// Jadwalkan pengambilan ringkasan pasar setiap jam 7 pagi
cron.schedule('0 7 * * *', fetchMarketSummary, { timezone: "Asia/Jakarta" });


// --- ENDPOINTS API ---

// Endpoint 1: Mendapatkan harga emas terkini
app.get("/", (req, res) => {
    res.json(cachedGoldData);
});

// Endpoint 2: Mendapatkan ringkasan berita pasar
app.get("/api/ai/market-summary", (req, res) => {
    res.json(cachedMarketSummary);
});

// Endpoint 3: Wawasan Portofolio Cerdas
app.post("/api/ai/portfolio-insight", async (req, res) => {
    try {
        const { totalEmas, avgBeli, totalProfit } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Anda adalah seorang penasihat keuangan yang suportif. Seorang investor emas memiliki portofolio sebagai berikut: Total Emas: ${totalEmas} gram, Rata-rata Harga Beli: Rp ${Math.round(avgBeli)}/gram, Total Keuntungan/Kerugian Saat Ini: Rp ${Math.round(totalProfit)}. Berikan analisis singkat dan saran yang personal dan memotivasi dalam satu paragraf. Gunakan bahasa yang mudah dimengerti.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ insight: response.text() });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghasilkan wawasan AI." });
    }
});

// Endpoint 4: Perencana Tujuan Finansial
app.post("/api/ai/goal-planner", async (req, res) => {
    try {
        const { goalName, goalTarget, goalYears, currentValue } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Anda adalah seorang perencana keuangan. Klien saya punya tujuan: '${goalName}' sebesar Rp ${goalTarget} dalam ${goalYears} tahun. Aset emasnya untuk tujuan ini sekarang bernilai Rp ${currentValue}. Dengan asumsi kenaikan harga emas 7% per tahun, berikan rencana menabung emas bulanan yang konkret (dalam gram dan Rupiah) untuk mencapai tujuan tersebut. Berikan jawaban yang jelas dan memotivasi.`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        res.json({ plan: response.text() });
    } catch (error) {
        res.status(500).json({ error: "Gagal menghasilkan rencana tujuan." });
    }
});


// --- MULAI SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Lakukan pengambilan data pertama kali saat server dinyalakan
    scrapeGoldPrice();
    fetchMarketSummary();
});
