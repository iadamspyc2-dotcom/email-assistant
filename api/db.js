'use strict';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'your_supabase_url'; // Replace with your Supabase URL
const supabaseAnonKey = 'your_anon_key'; // Replace with your Supabase Anon Key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to handle GET requests
export const getData = async (tableName) => {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*');

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error retrieving data:', error.message);
        throw error;
    }
};

// Function to handle POST requests
export const postData = async (tableName, newData) => {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .insert([newData]);

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error posting data:', error.message);
        throw error;
    }
};

// Function to handle PATCH requests
export const patchData = async (tableName, id, updatedData) => {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .update(updatedData)
            .match({ id: id });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error updating data:', error.message);
        throw error;
    }
};

// Function to handle DELETE requests
export const deleteData = async (tableName, id) => {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .delete()
            .match({ id: id });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Error deleting data:', error.message);
        throw error;
    }
};
