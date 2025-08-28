import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

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

    $("table.lm-table tbody tr").each((i, el) => {
      const cols = $(el).find("td");
      const gramasi = $(cols[0]).text().trim();
      const hargaJual = $(cols[1]).text().trim();
      const hargaBeli = $(cols[2]).text().trim();

      if (gramasi.includes("1 gr")) {
        data = { gramasi, hargaJual, hargaBeli };
      }
    });

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
