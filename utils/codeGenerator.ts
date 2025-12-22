
import { RequestConfig } from "../types";

export const generateLocalCode = (config: RequestConfig, language: string): string => {
  const { url, method, headers, body } = config;
  const enabledHeaders = headers.filter(h => h.enabled && h.key);
  const headerObj = enabledHeaders.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
  const safeBody = body || '{}';
  
  switch (language) {
    case 'curl': {
      let cmd = `curl --location --request ${method} '${url}'`;
      enabledHeaders.forEach(h => {
        cmd += ` \\\n--header '${h.key}: ${h.value}'`;
      });
      if (body && method !== 'GET') {
        cmd += ` \\\n--data-raw '${body.replace(/'/g, "'\\''")}'`;
      }
      return cmd;
    }

    case 'js-fetch':
      return `fetch("${url}", {
  method: "${method}",
  headers: ${JSON.stringify(headerObj, null, 2)},
  ${body && method !== 'GET' ? `body: ${JSON.stringify(body)}` : ''}
})
.then(response => response.json())
.then(result => console.log(result))
.catch(error => console.error('Error:', error));`;

    case 'ts-fetch':
      return `interface RequestHeaders {
  [key: string]: string;
}

const headers: RequestHeaders = ${JSON.stringify(headerObj, null, 2)};

async function makeRequest<T>(): Promise<T | void> {
  try {
    const response = await fetch("${url}", {
      method: "${method}",
      headers,
      ${body && method !== 'GET' ? `body: ${JSON.stringify(body)}` : ''}
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    return await response.json() as T;
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

makeRequest().then(data => console.log(data));`;

    case 'js-axios':
      return `const axios = require('axios');

const config = {
  method: '${method.toLowerCase()}',
  url: '${url}',
  headers: ${JSON.stringify(headerObj, null, 2)},
  ${body && method !== 'GET' ? `data: ${body}` : ''}
};

axios(config)
.then(response => {
  console.log(JSON.stringify(response.data));
})
.catch(error => {
  console.log(error);
});`;

    case 'ts-axios':
      return `import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

const config: AxiosRequestConfig = {
  method: '${method.toLowerCase()}',
  url: '${url}',
  headers: ${JSON.stringify(headerObj, null, 2)},
  ${body && method !== 'GET' ? `data: ${body}` : ''}
};

axios(config)
  .then((response: AxiosResponse) => {
    console.log(response.data);
  })
  .catch((error) => {
    console.error(error);
  });`;

    case 'node-axios':
      return `const axios = require('axios');

(async () => {
  try {
    const response = await axios({
      method: '${method.toLowerCase()}',
      url: '${url}',
      headers: ${JSON.stringify(headerObj, null, 2)},
      ${body && method !== 'GET' ? `data: ${body}` : ''}
    });
    console.log(response.data);
  } catch (error) {
    console.error('Error executing request:', error.message);
  }
})();`;

    case 'node-https': {
      const parsedUrl = new URL(url);
      return `const https = require('https');

const options = {
  hostname: '${parsedUrl.hostname}',
  port: 443,
  path: '${parsedUrl.pathname}${parsedUrl.search}',
  method: '${method}',
  headers: ${JSON.stringify(headerObj, null, 2)}
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Problem with request:', e.message);
});

${body && method !== 'GET' ? `req.write(${JSON.stringify(body)});` : ''}
req.end();`;
    }

    case 'python-requests': {
      return `import requests
import json

url = "${url}"
payload = ${body ? body : 'None'}
headers = ${JSON.stringify(headerObj, null, 2)}

response = requests.request("${method}", url, headers=headers, data=payload)
print(response.text)`;
    }

    case 'go-native': {
      return `package main

import (
  "fmt"
  "strings"
  "net/http"
  "io/ioutil"
)

func main() {
  url := "${url}"
  method := "${method}"
  payload := strings.NewReader(\`${body}\`)

  client := &http.Client {}
  req, _ := http.NewRequest(method, url, payload)

  ${enabledHeaders.map(h => `req.Header.Add("${h.key}", "${h.value}")`).join('\n  ')}

  res, _ := client.Do(req)
  defer res.Body.Close()

  body, _ := ioutil.ReadAll(res.Body)
  fmt.Println(string(body))
}`;
    }

    case 'java-okhttp': {
      return `import okhttp3.*;

public class Main {
  public static void main(String[] args) throws Exception {
    OkHttpClient client = new OkHttpClient().newBuilder().build();
    MediaType mediaType = MediaType.parse("application/json");
    ${method !== 'GET' ? `RequestBody body = RequestBody.create(mediaType, "${body.replace(/"/g, "\\\"")}");` : 'RequestBody body = null;'}
    
    Request request = new Request.Builder()
      .url("${url}")
      .method("${method}", body)
      ${enabledHeaders.map(h => `.addHeader("${h.key}", "${h.value}")`).join('\n      ')}
      .build();
      
    Response response = client.newCall(request).execute();
    System.out.println(response.body().string());
  }
}`;
    }

    default:
      return "// Language not supported";
  }
};
