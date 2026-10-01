import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import ticketRoutes from './routes/ticketRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import { isMobileDevice } from './services/securityEngine.js';
import { slaScheduler } from './services/slaScheduler.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});
app.set('io', io);
global.__io = io;

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// 50mb limit to handle attachments (PDF, Excel, Images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Mobile Device API Gatekeeper (Protocol #1 Server Enforcement)
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/security')) {
    return next();
  }
  if (isMobileDevice(req)) {
    return res.status(403).json({
      error: 'MOBILE_DEVICE_BLOCKED',
      title: 'Desktop Access Required',
      message: 'This software is available only on authorized desktop or laptop devices. Please open this link on your company laptop or PC to access the NetBounce Ticketing System.',
    });
  }
  next();
});

// Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/security', securityRoutes);

// Root landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>NetBounce API Server</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #131b2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; text-align: center; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .status { display: inline-flex; align-items: center; gap: 8px; color: #10b981; font-weight: 600; font-size: 14px; background: rgba(16,185,129,0.1); padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.2); margin-bottom: 20px; }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
          h1 { margin: 0 0 10px 0; font-size: 24px; color: #fff; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; transition: transform 0.2s; }
          .btn:hover { transform: translateY(-2px); }
          .links { margin-top: 20px; font-size: 13px; }
          .links a { color: #6366f1; text-decoration: none; margin: 0 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="status"><span class="dot"></span> MongoDB Atlas Connected</div>
          <h1>🚀 NetBounce API Server</h1>
          <p>The backend REST API is online and synchronized with your MongoDB cloud database (<b>tes_desk</b>).</p>
          <a class="btn" href="http://localhost:5173" target="_self">Open Web App Dashboard (Port 5173) &rarr;</a>
          <div class="links">
            <a href="/api/tickets">/api/tickets (JSON)</a> &bull;
            <a href="/api/health">/api/health</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'NetBounce Ticketing API',
  });
});

// Start Server immediately so proxy connects without delay, then connect DB
const startServer = () => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 NetBounce API Server (with Socket.io) running on http://localhost:${PORT}`);
    connectDB().then(() => {
      slaScheduler.start();
    }).catch((err) => {
      console.warn('DB connect error, still starting SLA worker:', err.message);
      slaScheduler.start();
    });
  });
};

startServer();
