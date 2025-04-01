# temp-file-sharing
A simple Node.js-based temporary file sharing service, similar to dropmefiles. Users can upload files via drag & drop, file selection, or clipboard paste. A unique download link is generated for each file, which is available for a configurable retention period before the file is automatically deleted. An anti-spam mechanism limits the number of uploads per IP, and once a file is uploaded, further uploads are disabled until a page refresh.

### Initial Setup

1. **Clone the repository**: Clone this repository using `git clone`.
2. **Download Dependencies**: download dependencies using `npm`.

```shell
git clone https://github.com/grisha765/temp-file-sharing
cd temp-file-sharing
npm install
```

### Deploy

- Run:
    ```bash
    npm start
    ```

- Other working env's:
    ```env
    PORT=3000
    FILE_RETENTION="30"
    FILE_SIZE_LIMIT="10"
    PUBLIC_DOMAIN="example.com"
    UPLOAD_LIMIT="5"
    ```

#### Container

- Pull container:
    ```bash
    podman pull ghcr.io/grisha765/temp-file-sharing:latest
    ```

- Deploy in container
    ```bash
    podman run --tmpfs /tmp -d \
    --name temp-file-sharing \
    -p 3000:3000 \
    -e PORT="3000" \
    ghcr.io/grisha765/temp-file-sharing:latest
    ```

#### Proxy on nginx

- Create a file /etc/nginx/sites-enabled/example.com with the lines:
    ```nginx
    server {
        listen 80 default;
        server_name example.com;
     
        location / {
            proxy_pass http://127.0.0.1:3000/;
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

## Features

- **Multiple Upload Methods:**  
  Drag & drop, file selection, and clipboard paste support.
  
- **Temporary File Storage:**  
  Files are stored in `/tmp/temp-files` and automatically deleted after a configurable retention period.
  
- **Download Link Generation:**  
  Each upload generates a unique download link.
  
- **Anti-Spam Protection:**  
  Limits the number of uploads from a single IP within a 5‑minute window. Excessive uploads result in a temporary block.
  
- **Proxy Friendly:**  
  Supports Nginx proxy configuration by using `app.set('trust proxy', true)` and the `PUBLIC_DOMAIN` environment variable.

- **Client UI:**  
  Once a file is uploaded, the drag & drop zone is removed and the download link along with the original file name is displayed.
