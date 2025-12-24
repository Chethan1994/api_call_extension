
import { RequestConfig } from "../types";

export const generateLocalCode = (config: RequestConfig, language: string): string => {
  const { url, method, headers, body } = config;
  const enabledHeaders = headers.filter(h => h.enabled && h.key);
  const headerObj = enabledHeaders.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
  const isFtp = url.startsWith('ftp://');

  if (isFtp) {
    switch(language) {
      case 'node-ftp':
        return `const ftp = require("basic-ftp")

async function example() {
    const client = new ftp.Client()
    client.ftp.verbose = true
    try {
        await client.access({
            host: "${new URL(url).hostname}",
            user: "anonymous",
            password: "password",
            secure: true
        })
        console.log(await client.list())
        await client.downloadTo("local-file.txt", "${new URL(url).pathname}")
    }
    catch(err) {
        console.log(err)
    }
    client.close()
}

example()`;
      default:
        return "// FTP operations typically require a specialized client library (e.g., 'basic-ftp' in Node.js).";
    }
  }

  switch (language) {
    case 'react-axios':
      return `import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ApiComponent = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios({
          url: '${url}',
          method: '${method}',
          headers: ${JSON.stringify(headerObj, null, 2)},
          ${body && method !== 'GET' ? `data: ${body}` : ''}
        });
        setData(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  return <div>{JSON.stringify(data)}</div>;
};

export default ApiComponent;`;

    case 'angular-http':
      return `import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-api-call',
  template: '<div *ngIf="data">{{ data | json }}</div>'
})
export class ApiCallComponent implements OnInit {
  data: any;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const headers = new HttpHeaders(${JSON.stringify(headerObj, null, 2)});
    this.http.request('${method}', '${url}', {
      headers,
      ${body && method !== 'GET' ? `body: ${body}` : ''}
    }).subscribe(response => {
      this.data = response;
    });
  }
}`;

    case 'nextjs-server':
      return `// Next.js Server Action
'use server'

export async function fetchData() {
  const response = await fetch('${url}', {
    method: '${method}',
    headers: ${JSON.stringify(headerObj, null, 2)},
    ${body && method !== 'GET' ? `body: ${JSON.stringify(body)}` : ''},
    cache: 'no-store' // or 'force-cache'
  });

  if (!response.ok) throw new Error('Failed to fetch data');
  return response.json();
}

// In your Server Component:
// const data = await fetchData();`;

    case 'js-fetch':
      return `fetch("${url}", {
  method: "${method}",
  headers: ${JSON.stringify(headerObj, null, 2)},
  ${body && method !== 'GET' ? `body: ${JSON.stringify(body)}` : ''}
})
.then(response => response.json())
.then(result => console.log(result))
.catch(error => console.error('Error:', error));`;

    default:
      return "// Code template for this configuration is being generated...";
  }
};
