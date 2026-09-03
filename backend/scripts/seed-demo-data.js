const path = require("path");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DEMO_EMAIL = "demo.sena@dinamicash.com";
const DEMO_PIN = "1234";

const categories = [
  { nombre: "Salario", icono: "COP" },
  { nombre: "Transporte", icono: "BUS" },
  { nombre: "Comida", icono: "FOOD" },
  { nombre: "Servicios", icono: "BILL" },
  { nombre: "Ahorro", icono: "SAVE" },
  { nombre: "Educacion", icono: "EDU" }
];

const movements = [
  { tipo: "ingreso", monto: 2200000, descripcion: "Salario mensual de prueba", categoria: "Salario", fecha: "2026-08-01 08:00:00" },
  { tipo: "gasto", monto: 180000, descripcion: "Transporte del mes", categoria: "Transporte", fecha: "2026-08-05 09:30:00" },
  { tipo: "gasto", monto: 320000, descripcion: "Mercado y almuerzos", categoria: "Comida", fecha: "2026-08-10 12:00:00" },
  { tipo: "gasto", monto: 145000, descripcion: "Internet y celular", categoria: "Servicios", fecha: "2026-08-15 18:00:00" },
  { tipo: "ingreso", monto: 250000, descripcion: "Ingreso extra de prueba", categoria: "Salario", fecha: "2026-08-20 10:00:00" },
  { tipo: "gasto", monto: 200000, descripcion: "Aporte a meta de ahorro", categoria: "Ahorro", fecha: "2026-08-25 16:00:00" }
];

const goals = [
  { nombre: "Ahorro", monto: 1500000, fecha_limite: "2026-12-15" },
  { nombre: "Educacion", monto: 800000, fecha_limite: "2026-11-30" }
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dinamicash",
    charset: "utf8mb4"
  });

  try {
    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(DEMO_PIN, 10);

    await connection.execute(
      `INSERT INTO usuarios (nombre, correo, password, email_verificado, email_verificado_en, datos_autorizados, datos_autorizados_en)
       VALUES (?, ?, ?, 1, NOW(), 1, NOW())
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         password = VALUES(password),
         email_verificado = 1,
         email_verificado_en = NOW(),
         datos_autorizados = 1,
         datos_autorizados_en = NOW()`,
      ["Demo SENA", DEMO_EMAIL, passwordHash]
    );

    const [[user]] = await connection.execute("SELECT id_usuario FROM usuarios WHERE correo = ? LIMIT 1", [DEMO_EMAIL]);
    const userId = user.id_usuario;

    await connection.execute("DELETE FROM movimientos WHERE id_usuario = ?", [userId]);
    await connection.execute("DELETE FROM metas WHERE id_usuario = ?", [userId]);
    await connection.execute("DELETE FROM categorias WHERE id_usuario = ?", [userId]);

    const categoryIds = new Map();
    for (const category of categories) {
      const [result] = await connection.execute(
        "INSERT INTO categorias (nombre, icono, id_usuario) VALUES (?, ?, ?)",
        [category.nombre, category.icono, userId]
      );
      categoryIds.set(category.nombre, result.insertId);
    }

    for (const movement of movements) {
      await connection.execute(
        `INSERT INTO movimientos (tipo, monto, descripcion, id_usuario, categoria_id, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          movement.tipo,
          movement.monto,
          movement.descripcion,
          userId,
          categoryIds.get(movement.categoria),
          movement.fecha
        ]
      );
    }

    for (const goal of goals) {
      await connection.execute(
        "INSERT INTO metas (nombre, monto, fecha_limite, id_usuario) VALUES (?, ?, ?, ?)",
        [goal.nombre, goal.monto, goal.fecha_limite, userId]
      );
    }

    await connection.execute(
      `INSERT INTO audit_logs (id_usuario, entidad, entidad_id, accion, detalle_json)
       VALUES (?, 'seed_demo', ?, 'crear_datos_prueba', JSON_OBJECT('correo', ?, 'movimientos', ?, 'metas', ?))`,
      [userId, userId, DEMO_EMAIL, movements.length, goals.length]
    );

    await connection.commit();

    console.log("Datos de prueba creados correctamente.");
    console.log(`Usuario: ${DEMO_EMAIL}`);
    console.log(`PIN: ${DEMO_PIN}`);
    console.log(`Movimientos: ${movements.length}`);
    console.log(`Metas: ${goals.length}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("No se pudieron crear los datos de prueba.");
  console.error(error);
  process.exit(1);
});
