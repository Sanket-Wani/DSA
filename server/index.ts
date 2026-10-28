import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from './middleware/authMiddleware.js';
import authRouter from './routes/auth.js';
import masterDataRouter from './routes/masterData.js';
import filesRouter from './routes/files.js';
import disbursementsRouter from './routes/disbursements.js';
import invoicesRouter from './routes/invoices.js';
import accountsRouter from './routes/accounts.js';
import reportsRouter from './routes/reports.js';
import usersRouter from './routes/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Global Auth Middleware
app.use(authMiddleware);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/master', masterDataRouter);
// Also alias directly for direct frontend calls
app.use('/api', masterDataRouter);
app.use('/api/files', filesRouter);
app.use('/api/disbursements', disbursementsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/reports', reportsRouter);

// Serve frontend build in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`[DSA Server] Running on http://localhost:${PORT}`);
});

export default app;
