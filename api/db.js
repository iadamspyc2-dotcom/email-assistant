'use strict';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function handleRequest(req, res) {
    const { method, url } = req;
    const urlParts = url.split('/');
    const tableName = urlParts[1]; // Assuming tableName is the first part of the URL after the base path

    try {
        if (method === 'GET') {
            const { data, error } = await supabase.from(tableName).select();
            if (error) throw error;
            return res.status(200).json(data);
        } else if (method === 'POST') {
            const body = await parseBody(req);
            const { data, error } = await supabase.from(tableName).insert([body]);
            if (error) throw error;
            return res.status(201).json(data);
        } else if (method === 'PATCH') {
            const body = await parseBody(req);
            const id = urlParts[2]; // Assuming the ID to patch is the second part of the URL
            const { data, error } = await supabase.from(tableName).update(body).match({ id });
            if (error) throw error;
            return res.status(200).json(data);
        } else if (method === 'DELETE') {
            const id = urlParts[2]; // Assuming the ID to delete is the second part of the URL
            const { data, error } = await supabase.from(tableName).delete().match({ id });
            if (error) throw error;
            return res.status(204).send();
        } else {
            return res.status(405).send('Method Not Allowed');
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

async function parseBody(req) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    return new Promise((resolve, reject) => {
        req.on('end', () => { resolve(JSON.parse(body)); });
        req.on('error', reject);
    });
}

module.exports = handleRequest;
