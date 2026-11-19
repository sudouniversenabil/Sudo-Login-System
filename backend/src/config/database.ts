import { Pool } from "pg";

import { env } from "./env.js"

export const pool = new Pool({
    connectionString:env.DATABASE_URL,
    max:10,
    idleTimeoutMillis:30_000,
    connectionTimeoutMillis:5_000
})
pool.on("error",(e)=>{
    console.log("Unexpected PostgreSQL pool error:", e)
})

let isClosing=false

export async function closePool():Promise<void>{
    if (isClosing) return

    isClosing = true
    try {
        await pool.end()
        console.log("PostgreSQL pool closed cleanly")
    }catch(e){
        console.log("Error while closing PostgreSQL pool:", e)
    }
}