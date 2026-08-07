const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MySQL Connection Setup
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

// Test Database Connection
db.getConnection((err, conn) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to Hostinger MySQL Database!');
    conn.release();
  }
});

// 1. Get all quotations
app.get('/api/quotations', (req, res) => {
  db.query('SELECT * FROM quotations ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const formatted = results.map((row) => {
      let parsed = {};
      if (row.full_data) {
        try {
          parsed = JSON.parse(row.full_data);
        } catch (e) {
          console.error('JSON parse error:', e);
        }
      }
      return {
        ...parsed,
        id: row.id,
        quotationNumber: row.quotation_number || parsed.quotationNumber,
        customerName:
          row.customer_name ||
          parsed.customerName ||
          parsed.customerSnapshot?.name ||
          'Guest Customer',
        customerSnapshot: parsed.customerSnapshot || { name: row.customer_name },
        totalCFT: parseFloat(row.total_cft || parsed.totalCFT || 0),
        grandTotal: parseFloat(row.total_amount || parsed.grandTotal || 0),
        date: row.created_at || parsed.date || new Date().toISOString(),
      };
    });

    res.json(formatted);
  });
});

// 2. Get single quotation by ID
app.get('/api/quotations/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM quotations WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ error: 'Quotation not found' });

    const row = results[0];
    let parsed = {};
    if (row.full_data) {
      try {
        parsed = JSON.parse(row.full_data);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    res.json({
      ...parsed,
      id: row.id,
      quotationNumber: row.quotation_number || parsed.quotationNumber,
      customerName:
        row.customer_name ||
        parsed.customerName ||
        parsed.customerSnapshot?.name ||
        'Guest Customer',
      customerSnapshot: parsed.customerSnapshot || { name: row.customer_name },
      totalCFT: parseFloat(row.total_cft || parsed.totalCFT || 0),
      grandTotal: parseFloat(row.total_amount || parsed.grandTotal || 0),
      sections: parsed.sections || [],
      additionalCharges: parsed.additionalCharges || [],
      date: row.created_at || parsed.date || new Date().toISOString(),
    });
  });
});

// 3. Create a new quotation
app.post('/api/quotations', (req, res) => {
  const { quotationNumber, customerName, totalCft, totalAmount, fullData } = req.body;
  const sql =
    'INSERT INTO quotations (quotation_number, customer_name, total_cft, total_amount, full_data) VALUES (?, ?, ?, ?, ?)';

  const fullDataJson = JSON.stringify(fullData || {});

  db.query(
    sql,
    [quotationNumber, customerName, totalCft, totalAmount, fullDataJson],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Quotation saved!', id: result.insertId });
    }
  );
});

// 4. Update an existing quotation
app.put('/api/quotations/:id', (req, res) => {
  const { id } = req.params;
  const { customerName, totalCft, totalAmount, fullData } = req.body;
  const sql =
    'UPDATE quotations SET customer_name = ?, total_cft = ?, total_amount = ?, full_data = ? WHERE id = ?';

  const fullDataJson = JSON.stringify(fullData || {});

  db.query(
    sql,
    [customerName, totalCft, totalAmount, fullDataJson, id],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Quotation updated successfully!' });
    }
  );
});

// 5. Delete a quotation
app.delete('/api/quotations/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM quotations WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Quotation deleted successfully!' });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});