
import { RequestConfig } from "../types";

export const generateLocalCode = (config: RequestConfig, language: string): string => {
  // Use active scenario for headers and body since they are not top-level on RequestConfig
  const activeScenario = config.scenarios[config.activeScenarioIndex] || config.scenarios[0];
  const { url, method, auth } = config;
  const headers = activeScenario?.headers || [];
  const body = activeScenario?.body || '';

  const enabledHeaders = headers.filter(h => h.enabled && h.key);
  const headerObj = enabledHeaders.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});

  // Handle Database Queries
  if (method === 'MONGO_QUERY') {
    switch (language) {
      case 'node-mongodb':
        return `const { MongoClient } = require('mongodb');

async function runQuery() {
  const client = new MongoClient('${url}');
  try {
    await client.connect();
    const db = client.db('target_db');
    const col = db.collection('target_collection');
    
    // Auto-generated query
    const query = ${body};
    const result = await col.find(query).toArray();
    console.log(result);
  } catch (err) {
    console.error("Execution failed:", err);
  } finally {
    await client.close();
  }
}

runQuery();`;
      case 'python-pymongo':
        return `from pymongo import MongoClient

def run_query():
    client = MongoClient('${url}')
    db = client['target_db']
    collection = db['target_collection']
    
    # Auto-generated query
    query = ${body}
    results = collection.find(query)
    for doc in results:
        print(doc)

if __name__ == "__main__":
    run_query()`;
      default:
        return `// No template for ${language} in MongoDB mode.`;
    }
  }

  if (method === 'SQL_QUERY') {
    switch (language) {
      case 'node-pg':
        return `const { Client } = require('pg');

async function executeSql() {
  const client = new Client({ connectionString: '${url}' });
  try {
    await client.connect();
    const res = await client.query(\`${body}\`);
    console.log(res.rows);
  } catch (err) {
    console.error(err.stack);
  } finally {
    await client.end();
  }
}

executeSql();`;
      case 'node-mysql2':
        return `const mysql = require('mysql2/promise');

async function executeSql() {
  const connection = await mysql.createConnection('${url}');
  try {
    const [rows, fields] = await connection.execute(\`${body}\`);
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

executeSql();`;
      case 'python-psycopg2':
        return `import psycopg2

def execute_sql():
    conn = psycopg2.connect('${url}')
    cur = conn.cursor()
    try:
        cur.execute(\"\"\"${body}\"\"\")
        rows = cur.fetchall()
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    execute_sql()`;
      case 'sql-raw':
        return `-- Raw Generated Query\n${body}`;
      default:
        return `// No template for ${language} in SQL mode.`;
    }
  }

  // Handle standard REST API calls
  switch (language) {
    case 'javascript-fetch':
      return `const executeRequest = async () => {
  const options = {
    method: '${method}',
    headers: ${JSON.stringify(headerObj, null, 2)},
    ${body && !['GET', 'HEAD'].includes(method) ? `body: JSON.stringify(${body})` : ''}
  };

  try {
    const response = await fetch('${url}', options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Fetch error:', error);
  }
};`;

    case 'javascript-axios':
      return `import axios from 'axios';

const executeRequest = async () => {
  try {
    const response = await axios({
      url: '${url}',
      method: '${method}',
      headers: ${JSON.stringify(headerObj, null, 2)},
      ${body && !['GET', 'HEAD'].includes(method) ? `data: ${body}` : ''}
    });
    return response.data;
  } catch (error) {
    console.error('Axios error:', error);
  }
};`;

    case 'python-requests':
      return `import requests
import json

def execute_request():
    url = '${url}'
    headers = ${JSON.stringify(headerObj, null, 4)}
    ${body && !['GET', 'HEAD'].includes(method) ? `payload = ${body}` : 'payload = None'}

    try:
        response = requests.request(
            "${method}", 
            url, 
            headers=headers, 
            data=json.dumps(payload) if payload else None
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    result = execute_request()
    print(result)`;

    case 'curl':
      const headerString = enabledHeaders.map(h => `-H "${h.key}: ${h.value}"`).join(' ');
      const dataString = body && !['GET', 'HEAD'].includes(method) ? `-d '${body.replace(/'/g, "'\\''")}'` : '';
      return `curl -X ${method} "${url}" \\
  ${headerString} \\
  ${dataString}`;

    default:
      return `// Code template for ${language} / ${method} is pending implementation.`;
  }
};
