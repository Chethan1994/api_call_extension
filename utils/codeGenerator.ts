
import { RequestConfig } from "../types";

export const generateLocalCode = (config: RequestConfig, language: string): string => {
  const { url, method, headers, body } = config;
  const enabledHeaders = headers.filter(h => h.enabled && h.key);
  
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

    case 'javascript': {
      const headerObj = enabledHeaders.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
      return `fetch("${url}", {
  method: "${method}",
  headers: ${JSON.stringify(headerObj, null, 2)},
  ${body && method !== 'GET' ? `body: JSON.stringify(${body})` : ''}
})
.then(response => response.text())
.then(result => console.log(result))
.catch(error => console.log('error', error));`;
    }

    case 'python': {
      const headerObj = enabledHeaders.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
      return `import requests
import json

url = "${url}"
payload = ${body ? body : 'None'}
headers = ${JSON.stringify(headerObj, null, 2)}

response = requests.request("${method}", url, headers=headers, data=payload)
print(response.text)`;
    }

    case 'go': {
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

    case 'java': {
      return `OkHttpClient client = new OkHttpClient().newBuilder().build();
MediaType mediaType = MediaType.parse("text/plain");
RequestBody body = RequestBody.create(mediaType, "${body.replace(/"/g, "\\\"")}");
Request request = new Request.Builder()
  .url("${url}")
  .method("${method}", body)
  ${enabledHeaders.map(h => `.addHeader("${h.key}", "${h.value}")`).join('\n  ')}
  .build();
Response response = client.newCall(request).execute();`;
    }

    default:
      return "// Language not supported";
  }
};
