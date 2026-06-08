const SAMPLES = {
  "ansible.cfg": {
    language: "ini",
    runHint: "cd ansible && ansible-playbook playbooks/site.yml -i inventories/production/",
    content: `[defaults]
inventory = inventories/production/hosts.ini
roles_path = roles
remote_user = deploy
private_key_file = ~/.ssh/deploy_key
host_key_checking = True
retry_files_enabled = False
gathering = smart
fact_caching = jsonfile
fact_caching_connection = /tmp/ansible_facts
fact_caching_timeout = 3600
stdout_callback = yaml
bin_ansible_callbacks = True
interpreter_python = auto_silent

vault_password_file = vault/.vault_pass

[privilege_escalation]
become = True
become_method = sudo
become_user = root
become_ask_pass = False

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s -o ServerAliveInterval=30
`
  },

  "inventories/production/hosts.ini": {
    language: "ini",
    runHint: "ansible all -i inventories/production/hosts.ini -m ping",
    content: `[webservers]
web1.example.com ansible_host=10.0.1.10
web2.example.com ansible_host=10.0.1.11

[databases]
db1.example.com ansible_host=10.0.2.10

[loadbalancers]
lb1.example.com ansible_host=10.0.0.5

# Nested groups — webservers inherit vars from 'web' parent
[web:children]
webservers
loadbalancers

[production:children]
web
databases

[webservers:vars]
ansible_user=deploy
ansible_python_interpreter=/usr/bin/python3

[databases:vars]
ansible_user=deploy
postgres_listen_addresses=127.0.0.1
`
  },

  "inventories/production/group_vars/all.yml": {
    language: "yaml",
    content: `---
env: production
domain: myapp.com
deploy_user: deploy
timezone: UTC

ansible_user: deploy
ansible_ssh_common_args: '-o StrictHostKeyChecking=accept-new'

# Pull secrets from vault at runtime (decrypted automatically)
vault_file: "{{ playbook_dir }}/../vault/secrets.yml"

monitoring_enabled: true
log_level: info
`
  },

  "inventories/production/group_vars/webservers.yml": {
    language: "yaml",
    content: `---
http_port: 80
https_port: 443
nginx_workers: 4
nginx_worker_connections: 2048

app_name: myapp
app_dir: /var/www/myapp
frontend_root: "{{ app_dir }}/frontend"
backend_socket: 127.0.0.1:8000

ssl_enabled: true
ssl_cert_path: /etc/letsencrypt/live/{{ domain }}/fullchain.pem
ssl_key_path: /etc/letsencrypt/live/{{ domain }}/privkey.pem

# Upstream backends for load balancing across app servers
backend_upstreams:
  - name: api_primary
    servers:
      - 127.0.0.1:8000 weight=1
      - 10.0.1.12:8000 weight=1 backup
`
  },

  "inventories/production/group_vars/databases.yml": {
    language: "yaml",
    content: `---
postgres_version: "15"
postgres_port: 5432
db_name: myapp_prod
db_user: myapp
max_connections: 200
shared_buffers: 256MB
effective_cache_size: 1GB
wal_level: replica

# Connection string built from vault secrets at deploy time
db_host: localhost
db_url: "postgresql://{{ db_user }}:{{ vault_db_password }}@{{ db_host }}:{{ postgres_port }}/{{ db_name }}"
`
  },

  "inventories/production/host_vars/web1.example.com.yml": {
    language: "yaml",
    content: `---
# web1 has 8 cores — override group default of 4
nginx_workers: 8
nginx_worker_connections: 4096

# This node serves as backup artifact store during deploys
backup_node: true
deploy_staging_slot: false

# Pin to a specific release channel for canary testing
release_channel: stable
`
  },

  "inventories/staging/hosts.ini": {
    language: "ini",
    runHint: "ansible-playbook playbooks/deploy.yml -i inventories/staging/ --check",
    content: `[webservers]
staging-web.example.com ansible_host=10.1.1.10

[databases]
staging-db.example.com ansible_host=10.1.2.10

[staging:children]
webservers
databases

[all:vars]
ansible_user=deploy
`
  },

  "inventories/staging/group_vars/all.yml": {
    language: "yaml",
    content: `---
env: staging
domain: staging.myapp.com
deploy_user: deploy

# Smaller resource footprint than production
nginx_workers: 2
max_connections: 50

log_level: debug
monitoring_enabled: false
ssl_enabled: true

api_url: "https://staging.myapp.com/api"
`
  },

  "playbooks/site.yml": {
    language: "yaml",
    runHint: "ansible-playbook playbooks/site.yml -i inventories/production/ --ask-vault-pass",
    content: `---
# Master playbook — full environment convergence
- name: Apply baseline to all hosts
  hosts: all
  become: true
  serial: "{{ serial_batch_size | default('100%') }}"
  tags: [always, common]
  pre_tasks:
    - name: Load encrypted secrets
      ansible.builtin.include_vars:
        file: "{{ vault_file }}"
      tags: [always]

    - name: Verify connectivity
      ansible.builtin.ping:
      tags: [always]

  roles:
    - role: common
      tags: [common]

- name: Configure web tier
  hosts: webservers
  become: true
  tags: [web, nginx]
  roles:
    - role: webserver
      tags: [webserver, nginx]

- name: Deploy frontend assets
  hosts: webservers
  become: true
  tags: [frontend, deploy]
  roles:
    - role: frontend
      tags: [frontend]

- name: Deploy backend API
  hosts: webservers
  become: true
  tags: [backend, deploy]
  roles:
    - role: backend
      tags: [backend]

- name: Configure database tier
  hosts: databases
  become: true
  tags: [database]
  tasks:
    - name: Ensure PostgreSQL packages
      ansible.builtin.apt:
        name: "postgresql-{{ postgres_version }}"
        state: present
        update_cache: true
      tags: [database]

  post_tasks:
    - name: Deployment summary
      ansible.builtin.debug:
        msg: "Site playbook completed for {{ env }} ({{ domain }})"
      run_once: true
      tags: [always]
`
  },

  "playbooks/deploy.yml": {
    language: "yaml",
    runHint: "ansible-playbook playbooks/deploy.yml -i inventories/production/ --tags backend -e deploy_ref=v2.4.1",
    content: `---
# Rolling deploy — no reprovisioning, just app updates
- name: Deploy application (rolling)
  hosts: webservers
  become: true
  serial: "{{ deploy_serial | default(1) }}"
  max_fail_percentage: 0
  vars:
    deploy_ref: "{{ lookup('env', 'DEPLOY_REF') | default('main', true) }}"
    deploy_serial: 1

  pre_tasks:
    - name: Load vault secrets
      ansible.builtin.include_vars:
        file: "{{ vault_file }}"

    - name: Record deploy metadata
      ansible.builtin.set_fact:
        deploy_started_at: "{{ ansible_date_time.iso8601 }}"
      run_once: true

  tasks:
    - name: Deploy backend
      ansible.builtin.import_role:
        name: backend
        tasks_from: main
      tags: [backend]
      vars:
        git_version: "{{ deploy_ref }}"

    - name: Deploy frontend
      ansible.builtin.import_role:
        name: frontend
        tasks_from: main
      tags: [frontend]

    - name: Wait for health check
      ansible.builtin.uri:
        url: "http://127.0.0.1:8000/health"
        status_code: 200
      register: health
      retries: 10
      delay: 3
      until: health.status == 200
      tags: [backend, verify]

  post_tasks:
    - name: Notify deploy channel
      ansible.builtin.debug:
        msg: "Deployed {{ deploy_ref }} to {{ inventory_hostname }} at {{ deploy_started_at }}"
      when: not ansible_check_mode
`
  },

  "playbooks/provision.yml": {
    language: "yaml",
    runHint: "ansible-playbook playbooks/provision.yml -i inventories/production/ --limit webservers",
    content: `---
# First-boot provisioning for fresh servers
- name: Provision base system
  hosts: all
  become: true
  gather_facts: true

  pre_tasks:
    - name: Wait for cloud-init to finish
      ansible.builtin.wait_for_connection:
        timeout: 300

    - name: Set hostname
      ansible.builtin.hostname:
        name: "{{ inventory_hostname }}"
      when: ansible_hostname != inventory_hostname

  roles:
    - role: common
    - role: webserver
      when: "'webservers' in group_names"

  tasks:
    - name: Configure UFW defaults
      community.general.ufw:
        direction: incoming
        policy: deny
      when: ansible_os_family == 'Debian'

    - name: Allow SSH
      community.general.ufw:
        rule: allow
        port: "22"
        proto: tcp

    - name: Allow HTTP/HTTPS on webservers
      community.general.ufw:
        rule: allow
        port: "{{ item }}"
        proto: tcp
      loop: [80, 443]
      when: "'webservers' in group_names"

    - name: Enable UFW
      community.general.ufw:
        state: enabled
      when: ansible_os_family == 'Debian'

  post_tasks:
    - name: Reboot if kernel updated
      ansible.builtin.reboot:
        msg: "Reboot triggered by Ansible provision playbook"
        connect_timeout: 5
        reboot_timeout: 600
      when: reboot_required | default(false)
`
  },

  "playbooks/rollback.yml": {
    language: "yaml",
    runHint: "ansible-playbook playbooks/rollback.yml -i inventories/production/ -e rollback_tag=v2.3.0",
    content: `---
- name: Roll back application release
  hosts: webservers
  become: true
  serial: 1
  vars:
    rollback_tag: "{{ rollback_tag | mandatory }}"
    app_path: "{{ app_dir }}/backend"

  pre_tasks:
    - name: Load vault secrets
      ansible.builtin.include_vars:
        file: "{{ vault_file }}"

    - name: Confirm rollback target
      ansible.builtin.pause:
        prompt: "Rollback {{ inventory_hostname }} to {{ rollback_tag }}? Press Enter to continue, Ctrl+C to abort"
      run_once: true
      when: env == 'production'

  tasks:
    - name: Checkout previous release tag
      ansible.builtin.git:
        repo: "{{ repo_url }}"
        dest: "{{ app_path }}"
        version: "{{ rollback_tag }}"
        force: true
      notify: Restart backend

    - name: Reinstall Python dependencies for rolled-back code
      ansible.builtin.pip:
        requirements: "{{ app_path }}/requirements.txt"
        virtualenv: "{{ app_path }}/.venv"
        virtualenv_command: python3 -m venv
      notify: Restart backend

    - name: Render .env for rolled-back release
      ansible.builtin.template:
        src: roles/backend/templates/.env.j2
        dest: "{{ app_path }}/.env"
        owner: "{{ deploy_user }}"
        mode: "0600"
      notify: Restart backend

  handlers:
    - name: Restart backend
      ansible.builtin.systemd:
        name: "{{ app_name }}"
        state: restarted
        daemon_reload: true
`
  },

  "group_vars/all.yml": {
    language: "yaml",
    content: `---
# Shared across ALL environments (production + staging)
app_name: myapp
repo_url: https://github.com/yourorg/myapp.git
deploy_dir: /var/www
git_ssh_key: ~/.ssh/deploy_key

# Release management
releases_to_keep: 5
deploy_serial: 1

# Paths used by multiple roles
frontend_build_dir: "{{ playbook_dir }}/../../frontend/dist"
backend_service_name: "{{ app_name }}"
`
  },

  "roles/common/tasks/main.yml": {
    language: "yaml",
    content: `---
- name: Update apt cache
  ansible.builtin.apt:
    update_cache: true
    cache_valid_time: 3600
  when: ansible_os_family == 'Debian'

- name: Install common packages
  ansible.builtin.apt:
    name: "{{ common_packages }}"
    state: present
  when: ansible_os_family == 'Debian'

- name: Create deploy user
  ansible.builtin.user:
    name: "{{ deploy_user }}"
    groups: sudo
    append: true
    shell: /bin/bash
    create_home: true

- name: Authorize deploy SSH key
  ansible.posix.authorized_key:
    user: "{{ deploy_user }}"
    key: "{{ lookup('file', deploy_ssh_pubkey_path) }}"
    state: present

- name: Harden SSH — disable root login
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: "^#?PermitRootLogin"
    line: "PermitRootLogin no"
    validate: "sshd -t -f %s"
  notify: Restart sshd

- name: Harden SSH — disable password auth
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: "^#?PasswordAuthentication"
    line: "PasswordAuthentication no"
    validate: "sshd -t -f %s"
  notify: Restart sshd

- name: Enable unattended security upgrades
  ansible.builtin.apt:
    name: unattended-upgrades
    state: present
  when:
    - ansible_os_family == 'Debian'
    - common_enable_unattended_upgrades | bool

- name: Configure timezone
  community.general.timezone:
    name: "{{ timezone | default('UTC') }}"
`
  },

  "roles/common/handlers/main.yml": {
    language: "yaml",
    content: `---
# Handlers run at end of play, only if notified — and only once per play
- name: Restart sshd
  ansible.builtin.service:
    name: ssh
    state: restarted
  listen: "restart sshd"

- name: Reload sshd (graceful)
  ansible.builtin.service:
    name: ssh
    state: reloaded
  listen: "reload sshd"
`
  },

  "roles/common/defaults/main.yml": {
    language: "yaml",
    content: `---
# Lowest-priority variables — override in group_vars/host_vars
common_packages:
  - curl
  - git
  - htop
  - unzip
  - acl
  - python3-pip
  - python3-venv

common_enable_unattended_upgrades: true
deploy_ssh_pubkey_path: "{{ lookup('env', 'HOME') }}/.ssh/id_ed25519.pub"
`
  },

  "roles/webserver/tasks/main.yml": {
    language: "yaml",
    content: `---
- name: Install nginx
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true

- name: Ensure nginx is enabled
  ansible.builtin.service:
    name: nginx
    enabled: true
    state: started

- name: Deploy nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/sites-available/{{ app_name }}.conf
    owner: root
    group: root
    mode: "0644"
    validate: nginx -t -c /etc/nginx/nginx.conf
  notify:
    - Reload nginx

- name: Enable site
  ansible.builtin.file:
    src: /etc/nginx/sites-available/{{ app_name }}.conf
    dest: /etc/nginx/sites-enabled/{{ app_name }}.conf
    state: link
  notify:
    - Reload nginx

- name: Remove default nginx site
  ansible.builtin.file:
    path: /etc/nginx/sites-enabled/default
    state: absent
  notify:
    - Reload nginx

- name: Create app web root
  ansible.builtin.file:
    path: "{{ frontend_root }}"
    state: directory
    owner: "{{ deploy_user }}"
    group: www-data
    mode: "0755"
`
  },

  "roles/webserver/handlers/main.yml": {
    language: "yaml",
    content: `---
# Graceful reload — preferred when only config changes
- name: Reload nginx
  ansible.builtin.service:
    name: nginx
    state: reloaded
  listen: "reload nginx"

# Full restart — use when modules change or reload fails
- name: Restart nginx
  ansible.builtin.service:
    name: nginx
    state: restarted
  listen: "restart nginx"
`
  },

  "roles/webserver/templates/nginx.conf.j2": {
    language: "yaml",
    content: `# Rendered by Ansible — do not edit on server directly
upstream {{ app_name }}_api {
{% for upstream in backend_upstreams %}
    {% for server in upstream.servers %}
    server {{ server }};
    {% endfor %}
{% endfor %}
    keepalive 32;
}

# Redirect HTTP -> HTTPS
server {
    listen {{ http_port }};
    listen [::]:{{ http_port }};
    server_name {{ domain }} www.{{ domain }};
    return 301 https://$host$request_uri;
}

server {
    listen {{ https_port }} ssl http2;
    listen [::]:{{ https_port }} ssl http2;
    server_name {{ domain }} www.{{ domain }};

{% if ssl_enabled %}
    ssl_certificate     {{ ssl_cert_path }};
    ssl_certificate_key {{ ssl_key_path }};
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
{% endif %}

    root {{ frontend_root }};
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://{{ app_name }}_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    location /health {
        proxy_pass http://{{ app_name }}_api/health;
        access_log off;
    }

    # Static asset caching
    location ~* \\.(js|css|png|jpg|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
`
  },

  "roles/backend/tasks/main.yml": {
    language: "yaml",
    runHint: "ansible-playbook playbooks/deploy.yml -i inventories/production/ --tags backend",
    content: `---
- name: Ensure app directory exists
  ansible.builtin.file:
    path: "{{ app_dir }}/backend"
    state: directory
    owner: "{{ deploy_user }}"
    group: "{{ deploy_user }}"
    mode: "0755"

- name: Clone or update application repository
  ansible.builtin.git:
    repo: "{{ repo_url }}"
    dest: "{{ app_dir }}/backend"
    version: "{{ git_version | default('main') }}"
    accept_hostkey: true
    key_file: "{{ git_ssh_key }}"
  become_user: "{{ deploy_user }}"
  notify: Restart backend

- name: Create Python virtualenv
  ansible.builtin.command:
    cmd: python3 -m venv {{ app_dir }}/backend/.venv
    creates: "{{ app_dir }}/backend/.venv/bin/activate"

- name: Install Python dependencies
  ansible.builtin.pip:
    requirements: "{{ app_dir }}/backend/requirements.txt"
    virtualenv: "{{ app_dir }}/backend/.venv"
  notify: Restart backend

- name: Deploy environment file from template
  ansible.builtin.template:
    src: .env.j2
    dest: "{{ app_dir }}/backend/.env"
    owner: "{{ deploy_user }}"
    mode: "0600"
  notify: Restart backend

- name: Install systemd unit
  ansible.builtin.copy:
    src: myapp.service
    dest: "/etc/systemd/system/{{ backend_service_name }}.service"
    mode: "0644"
  notify: Restart backend

- name: Enable and start backend service
  ansible.builtin.systemd:
    name: "{{ backend_service_name }}"
    enabled: true
    state: started
    daemon_reload: true

- name: Verify backend health endpoint
  ansible.builtin.uri:
    url: "http://127.0.0.1:8000/health"
    status_code: 200
  register: backend_health
  retries: 5
  delay: 2
  until: backend_health.status == 200
`
  },

  "roles/backend/handlers/main.yml": {
    language: "yaml",
    content: `---
- name: Restart backend
  ansible.builtin.systemd:
    name: "{{ backend_service_name }}"
    state: restarted
    daemon_reload: true
  listen: "restart backend"

- name: Reload backend (if app supports SIGHUP)
  ansible.builtin.systemd:
    name: "{{ backend_service_name }}"
    state: reloaded
  listen: "reload backend"
  ignore_errors: true
`
  },

  "roles/backend/templates/.env.j2": {
    language: "yaml",
    content: `# Rendered by Ansible — secrets from vault/secrets.yml
ENV={{ env }}
DEBUG={{ 'true' if env == 'staging' else 'false' }}
LOG_LEVEL={{ log_level }}

DATABASE_URL={{ db_url }}
SECRET_KEY={{ vault_secret_key }}
JWT_SECRET={{ vault_jwt_secret }}

REDIS_URL=redis://127.0.0.1:6379/0
SENTRY_DSN={{ vault_sentry_dsn | default('') }}

# Feature flags
FEATURE_BILLING={{ feature_billing | default(false) | lower }}
FEATURE_ANALYTICS={{ feature_analytics | default(true) | lower }}
`
  },

  "roles/backend/files/myapp.service": {
    language: "ini",
    content: `[Unit]
Description=MyApp Backend API
After=network.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User={{ deploy_user }}
Group={{ deploy_user }}
WorkingDirectory={{ app_dir }}/backend
EnvironmentFile={{ app_dir }}/backend/.env
ExecStart={{ app_dir }}/backend/.venv/bin/gunicorn \\
    --workers {{ gunicorn_workers | default(4) }} \\
    --bind 127.0.0.1:8000 \\
    --timeout 120 \\
    --access-logfile - \\
    --error-logfile - \\
    src.main:app
Restart=on-failure
RestartSec=5
KillMode=mixed
TimeoutStopSec=30

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths={{ app_dir }}/backend

[Install]
WantedBy=multi-user.target
`
  },

  "roles/frontend/tasks/main.yml": {
    language: "yaml",
    content: `---
- name: Ensure frontend root exists
  ansible.builtin.file:
    path: "{{ frontend_root }}"
    state: directory
    owner: "{{ deploy_user }}"
    group: www-data
    mode: "0755"

- name: Render frontend .env before build (if building on server)
  ansible.builtin.template:
    src: .env.j2
    dest: "{{ playbook_dir }}/../../frontend/.env"
    mode: "0644"
  delegate_to: localhost
  run_once: true
  when: build_on_controller | default(true)

- name: Build frontend on controller
  ansible.builtin.command:
    cmd: npm ci && npm run build
    chdir: "{{ playbook_dir }}/../../frontend"
  delegate_to: localhost
  run_once: true
  when: build_on_controller | default(true)
  changed_when: true

- name: Synchronize built assets to web root
  ansible.posix.synchronize:
    src: "{{ frontend_build_dir }}/"
    dest: "{{ frontend_root }}/"
    delete: true
    recursive: true
    rsync_opts:
      - "--chmod=D0755,F0644"
  notify: Reload nginx

- name: Set ownership on deployed assets
  ansible.builtin.file:
    path: "{{ frontend_root }}"
    owner: "{{ deploy_user }}"
    group: www-data
    recurse: true
`
  },

  "roles/frontend/templates/.env.j2": {
    language: "yaml",
    content: `# Public frontend env vars — safe to bake into build
VITE_APP_NAME={{ app_name }}
VITE_API_URL=https://{{ domain }}/api
VITE_ENV={{ env }}
VITE_SENTRY_DSN={{ vault_frontend_sentry_dsn | default('') }}
VITE_FEATURE_FLAGS={{ feature_flags | default({}) | to_json }}
`
  },

  "vault/secrets.yml": {
    language: "yaml",
    runHint: "ansible-vault view vault/secrets.yml  # or ansible-vault edit vault/secrets.yml",
    content: `---
# This file is encrypted with ansible-vault in real projects.
# Below is a realistic STRUCTURE — ciphertext is illustrative only.

vault_db_password: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          6638643965393664303761666537636533656238653332343130620a6265383761
          353865396638353061336430623761653461653865663865623234623665653865
          3965383130646531300a3136306132626438656538653538653538656634616538
          6638656232346236656538653965383130646531306238653332343130620a6265

vault_secret_key: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          3130620a6265383761353865396638353061336430623761666537636533656238
          653865663865623234623665653865396538313064653130623865333234313062
          0a6265383761353865396638353061336430623761666537636533656238656534

vault_jwt_secret: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          396638353061336430623761653461653865663865623234623665653865396538
          3130646531306238653332343130620a62653837613538653966383530613364

vault_sentry_dsn: !vault |
          $ANSIBLE_VAULT;1.1;AES256
          653865396638353061336430623761653461653865663865623234623665653865
          3965383130646531306238653332343130620a62653837613538653966383530

# In group_vars, reference as: {{ vault_db_password }}
# Encrypt with: ansible-vault encrypt vault/secrets.yml
`
  },

  "frontend/package.json": {
    language: "json",
    content: `{
  "name": "myapp-frontend",
  "version": "2.4.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  },
  "engines": {
    "node": ">=20"
  }
}
`
  },

  "frontend/.env.example": {
    language: "yaml",
    content: `# Copy to .env — Ansible renders the real file from roles/frontend/templates/.env.j2
VITE_APP_NAME=myapp
VITE_API_URL=http://localhost:8000/api
VITE_ENV=development
VITE_SENTRY_DSN=
`
  },

  "backend/requirements.txt": {
    language: "yaml",
    content: `# Python dependencies — installed by Ansible pip module into .venv
fastapi==0.112.0
uvicorn[standard]==0.30.5
gunicorn==22.0.0
sqlalchemy==2.0.32
psycopg2-binary==2.9.9
alembic==1.13.2
pydantic-settings==2.4.0
redis==5.0.8
httpx==0.27.0
python-jose[cryptography]==3.3.0
`
  },

  "backend/Dockerfile": {
    language: "docker",
    runHint: "# Optional: community.docker.docker_compose in a containerised deploy playbook",
    content: `FROM python:3.12-slim AS base

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential libpq-dev \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY alembic/ ./alembic/
COPY alembic.ini .

EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "src.main:app"]
`
  },

  "backend/.env.example": {
    language: "yaml",
    content: `# Local development — production uses Ansible template + Vault
ENV=development
DEBUG=true
LOG_LEVEL=debug

DATABASE_URL=postgresql://myapp:localdev@localhost:5432/myapp_dev
SECRET_KEY=change-me-in-production
JWT_SECRET=also-change-me

REDIS_URL=redis://127.0.0.1:6379/0
`
  },
};
