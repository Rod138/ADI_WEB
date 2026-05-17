/**
 * TESINA: Configuración de acceso a Supabase para todo el backend.
 * Responsabilidad: leer variables de entorno y exponer un cliente unico.
 * Impacto: cualquier fallo aqui impide operaciones de base de datos.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE (o SUPABASE_ANON) deben estar definidas en el archivo .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
        schema: 'public'
    }
});

export default supabase;
