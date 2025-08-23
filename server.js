require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

// Configuración de CORS
app.use(cors({
  origin: 'https://frontendg.vercel.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- RUTAS DE AUTENTICACIÓN ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashedPassword } });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'El email ya está en uso.' });
    console.error("ERROR EN REGISTER:", error);
    res.status(500).json({ error: 'No se pudo registrar el usuario.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Credenciales inválidas.' });
    }
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ accessToken });
  } catch (error) {
    console.error("ERROR EN LOGIN:", error);
    res.status(500).send();
  }
});

// --- RUTAS DE TIENDA ---
app.get('/api/store', authenticateToken, async (req, res) => {
  try {
    const store = await prisma.store.findUnique({ where: { userId: req.user.userId }, include: { products: true } });
    if (store) res.json(store);
    else res.status(404).json({ message: 'El usuario aún no tiene una tienda.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la tienda.' });
  }
});

app.post('/api/store', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    const generateSlug = (name) => name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    let finalSlug = generateSlug(name);

    let storeExists = await prisma.store.findUnique({ where: { slug: finalSlug } });
    while (storeExists) {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      finalSlug = `${generateSlug(name)}-${randomSuffix}`;
      storeExists = await prisma.store.findUnique({ where: { slug: finalSlug } });
    }

    const newStore = await prisma.store.create({ data: { name, slug: finalSlug, userId } });
    res.status(201).json(newStore);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'Este usuario ya tiene una tienda.' });
    console.error("ERROR EN CREATE STORE:", error);
    res.status(500).json({ error: 'No se pudo crear la tienda.' });
  }
});

app.put('/api/store/publish', authenticateToken, async (req, res) => {
  try {
    const store = await prisma.store.update({ where: { userId: req.user.userId }, data: { status: 'BUILT' } });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo publicar la tienda.' });
  }
});

app.put('/api/store/maintenance', authenticateToken, async (req, res) => {
  const { isMaintenanceMode } = req.body;
  try {
    const store = await prisma.store.update({ where: { userId: req.user.userId }, data: { isMaintenanceMode } });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo actualizar el modo mantenimiento.' });
  }
});

app.put('/api/store/template', authenticateToken, async (req, res) => {
  const { template, heroTitle, heroDescription, primaryColor } = req.body;
  try {
    const store = await prisma.store.update({ where: { userId: req.user.userId }, data: { template, heroTitle, heroDescription, primaryColor } });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  }
});

// --- RUTAS DE PRODUCTOS ---
app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, price, imageUrl, storeId } = req.body;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.userId !== req.user.userId) return res.status(403).json({ error: 'No tienes permiso.' });

  try {
    const product = await prisma.product.create({ data: { name, price, imageUrl, storeId } });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'No se pudo crear el producto.' });
  }
});

app.delete('/api/products/:productId', authenticateToken, async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { store: true } });
    if (!product) return res.status(404).json({ error: 'Producto no encontrado.' });
    if (product.store.userId !== req.user.userId) return res.status(403).json({ error: 'No tienes permiso para eliminar este producto.' });

    await prisma.product.delete({ where: { id: productId } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'No se pudo eliminar el producto.' });
  }
});

// --- RUTA PÚBLICA ---
app.get('/api/tiendas/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const store = await prisma.store.findUnique({ where: { slug, status: 'BUILT' }, include: { products: true } });
    if (store) res.json(store);
    else res.status(404).json({ error: 'Tienda no encontrada o no publicada.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la tienda.' });
  }
});

// Exporta la app para serverless
module.exports = app;
