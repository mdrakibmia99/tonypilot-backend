export const serverHomePage = (projectName: string) => `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Server Status</title>
    <style>
      body {
        margin: 0;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #fff;
      }

      .card {
        text-align: center;
        padding: 40px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.05);
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        backdrop-filter: blur(10px);
      }

      .status {
        font-size: 28px;
        font-weight: bold;
        color: #22c55e;
        margin-bottom: 10px;
      }

      .dot {
        height: 12px;
        width: 12px;
        background-color: #22c55e;
        border-radius: 50%;
        display: inline-block;
        margin-right: 8px;
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
        100% { transform: scale(1); opacity: 1; }
      }

      .project {
        margin: 15px 0;
        font-size: 18px;
        font-weight: 600;
        color: #60a5fa;
        letter-spacing: 1px;
      }

      .text {
        font-size: 16px;
        opacity: 0.8;
      }

      .footer {
        margin-top: 20px;
        font-size: 12px;
        opacity: 0.5;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="status">
        <span class="dot"></span> Server is Running ...
      </div>

      <div class="project">
        ${projectName}
      </div>

      <div class="text">All systems operational</div>
      <div class="footer">API backend is healthy 🚀</div>
    </div>
  </body>
  </html>
`;