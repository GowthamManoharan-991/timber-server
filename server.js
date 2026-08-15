const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. CORS Configuration (Allows frontend access)
app.use(
  cors({
    origin: [
      'https://timber.smtdoorindustries.com',
      'https://api.smtdoorindustries.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '10mb' }));

// 2. Base Health Check Route (Prevents "Cannot GET /")
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'SMT Timber Backend API is running successfully on Hostinger!'
  });
});

// 3. MySQL Connection Pool with Keep-Alive
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Auto-create database tables
db.getConnection((err, conn) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to Hostinger MySQL Database!');

    const createCustomersTable = `
      CREATE TABLE IF NOT EXISTS customers (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL DEFAULT '',
        phone VARCHAR(50) NOT NULL DEFAULT '',
        email VARCHAR(255) NOT NULL DEFAULT '',
        address TEXT NULL,
        gst_number VARCHAR(100) NOT NULL DEFAULT '',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createQuotationsTable = `
      CREATE TABLE IF NOT EXISTS quotations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        quotation_number VARCHAR(100),
        customer_name VARCHAR(255),
        total_cft DECIMAL(12, 3) DEFAULT 0.000,
        total_amount DECIMAL(12, 2) DEFAULT 0.00,
        full_data LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    conn.query(createCustomersTable, (tblErr) => {
      if (tblErr) console.error('❌ Error verifying customers table:', tblErr.message);
      else console.log('✅ Customers table ready!');
    });

    conn.query(createQuotationsTable, (tblErr) => {
      if (tblErr) console.error('❌ Error verifying quotations table:', tblErr.message);
      else console.log('✅ Quotations table ready!');
    });

    conn.release();
  }
});

/* ==========================================================================
   CUSTOMER API ENDPOINTS
   ========================================================================== */

// 1. Get all customers
app.get('/api/customers', (req, res) => {
  db.query('SELECT * FROM customers ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    const formatted = results.map((row) => ({
      id: row.id,
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      gstNumber: row.gst_number || '',
      notes: row.notes || '',
      createdAt: row.created_at
    }));
    res.json(formatted);
  });
});

// 2. Get single customer by ID
app.get('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM customers WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Customer not found' });
    const row = results[0];
    res.json({
      id: row.id,
      name: row.name || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      gstNumber: row.gst_number || '',
      notes: row.notes || '',
      createdAt: row.created_at
    });
  });
});

// 3. Add new customer
app.post('/api/customers', (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = String(req.body.email || '').trim();
    const address = String(req.body.address || '').trim();
    const gst_number = String(req.body.gstNumber || req.body.gst_number || '').trim();
    const notes = String(req.body.notes || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    const sql = `
      INSERT INTO customers (name, phone, email, address, gst_number, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [name, phone, email, address, gst_number, notes], (err, result) => {
      if (err) {
        console.error('❌ MySQL INSERT Error:', err.message);
        return res.status(500).json({ message: err.message });
      }

      return res.status(201).json({
        id: result.insertId,
        name,
        phone,
        email,
        address,
        gstNumber: gst_number,
        notes
      });
    });
  } catch (error) {
    console.error('❌ Exception in POST /api/customers:', error);
    return res.status(500).json({ message: error.message });
  }
});

// 4. Update customer
app.put('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const email = String(req.body.email || '').trim();
  const address = String(req.body.address || '').trim();
  const gst_number = String(req.body.gstNumber || req.body.gst_number || '').trim();
  const notes = String(req.body.notes || '').trim();

  const sql = `
    UPDATE customers 
    SET name = ?, phone = ?, email = ?, address = ?, gst_number = ?, notes = ? 
    WHERE id = ?
  `;

  db.query(sql, [name, phone, email, address, gst_number, notes, id], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Customer updated successfully!', id });
  });
});

// 5. Delete customer
app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM customers WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Customer deleted successfully!' });
  });
});

/* ==========================================================================
   QUOTATION API ENDPOINTS
   ========================================================================== */

// 1. Get all quotations
app.get('/api/quotations', (req, res) => {
  db.query('SELECT * FROM quotations ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ message: err.message });

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
        date: row.created_at || parsed.date || new Date().toISOString()
      };
    });

    res.json(formatted);
  });
});

// 2. Get single quotation by ID
app.get('/api/quotations/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM quotations WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Quotation not found' });

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
      date: row.created_at || parsed.date || new Date().toISOString()
    });
  });
});

// 3. Create new quotation
app.post('/api/quotations', (req, res) => {
  const { quotationNumber, customerName, totalCft, totalAmount, fullData } = req.body;
  const sql =
    'INSERT INTO quotations (quotation_number, customer_name, total_cft, total_amount, full_data) VALUES (?, ?, ?, ?, ?)';

  const fullDataJson = JSON.stringify(fullData || {});

  db.query(
    sql,
    [quotationNumber, customerName, totalCft || 0, totalAmount || 0, fullDataJson],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ message: 'Quotation saved!', id: result.insertId });
    }
  );
});

// 4. Update quotation
app.put('/api/quotations/:id', (req, res) => {
  const { id } = req.params;
  const { customerName, totalCft, totalAmount, fullData } = req.body;
  const sql =
    'UPDATE quotations SET customer_name = ?, total_cft = ?, total_amount = ?, full_data = ? WHERE id = ?';

  const fullDataJson = JSON.stringify(fullData || {});

  db.query(
    sql,
    [customerName, totalCft || 0, totalAmount || 0, fullDataJson, id],
    (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: 'Quotation updated successfully!' });
    }
  );
});

// 5. Delete quotation
app.delete('/api/quotations/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM quotations WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: 'Quotation deleted successfully!' });
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});