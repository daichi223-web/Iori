import express, { Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Hello World API endpoint
app.get('/api/hello', (req: Request, res: Response) => {
  res.json({
    message: 'Hello, World!',
    timestamp: new Date().toISOString()
  });
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export { app };
