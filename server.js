import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import cors from "cors";
import cron from "node-cron"; // Impor library node-cron

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Variabel untuk menyimpan data harga emas terakhir
let cachedGoldData = {
    status: "uninitialized",
    source: "https://anekalogam.co.id/id",
    data: {}
};

// Fungsi untuk melakukan scraping
const scrapeGoldPrice = async () => {
    console.log("Running scheduled scrape job...");
    try {
        const url = "https://anekalogam.co.id/id";
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36" },
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        let data = {};
        let found = false;

        $("table.lm-table tbody tr").each((i, el) => {
            if (found) return;
            const cols = $(el).find("td");
            if (cols.length >= 3) {
                const gramasi = $(cols[0]).text().trim();
                const hargaJual = $(cols[1]).text().replace(/[^0-9]/g, '');
                const hargaBeli = $(cols[2]).text().replace(/[^0-9]/g, '');

                if (gramasi.toLowerCase() === "1gram") {
                    data = { gramasi, hargaJual, hargaBeli };
                    found = true;
                }
            }
        });

        if (found) {
            cachedGoldData = { status: "success", source: url, data };
            console.log("Scrape successful. Data updated:", cachedGoldData.data);
        } else {
            console.log("Scrape failed: 1 gram data not found.");
            cachedGoldData.status = "error";
            cachedGoldData.message = "Data 1 gram tidak ditemukan.";
        }
    } catch (err) {
        console.error("Error during scraping:", err);
        cachedGoldData.status = "error";
        cachedGoldData.message = err.message;
    }
};

// Jadwalkan scraping untuk berjalan setiap jam 3 pagi (WIB)
// Format cron: 'menit jam hari bulan hari_dalam_minggu'
// '0 3 * * *' artinya jam 3, menit ke-0, setiap hari.
// Timezone diatur ke Asia/Jakarta
cron.schedule('0 3 * * *', scrapeGoldPrice, {
    scheduled: true,
    timezone: "Asia/Jakarta"
});


// Endpoint utama untuk mendapatkan data
app.get("/", (req, res) => {
    // Langsung kembalikan data yang sudah disimpan
    res.json(cachedGoldData);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Lakukan scraping pertama kali saat server dinyalakan
    scrapeGoldPrice();
});
