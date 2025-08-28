import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import cors from "cors"; // Tambahkan ini untuk mengizinkan akses dari domain lain

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk mengaktifkan CORS
app.use(cors());

app.get("/", async (req, res) => {
  try {
    const url = "https://anekalogam.co.id/id";
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();
    const $ = cheerio.load(html);

    let data = {};
    let found = false; // Variabel untuk menghentikan loop

    $("table.lm-table tbody tr").each((i, el) => {
      if (found) return; // Hentikan iterasi jika data sudah ditemukan

      const cols = $(el).find("td");
      
      if (cols.length >= 3) {
        const gramasi = $(cols[0]).text().trim();
        
        // --- PERBAIKAN DI SINI ---
        // Membersihkan harga dari karakter selain angka
        const hargaJual = $(cols[1]).text().replace(/[^0-9]/g, '');
        const hargaBeli = $(cols[2]).text().replace(/[^0-9]/g, '');

        if (gramasi.toLowerCase() === "1gram") {
          data = { gramasi, hargaJual, hargaBeli };
          found = true; // Set 'found' menjadi true agar loop berhenti
        }
      }
    });

    if (!found) {
        return res.status(404).json({
            status: "error",
            source: url,
            message: "Data harga untuk 1 gram tidak ditemukan. Mungkin struktur website berubah.",
            data: {}
        });
    }

    res.json({
      status: "success",
      source: url,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
