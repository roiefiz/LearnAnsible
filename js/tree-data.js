const TREE = [
  { indent: "", icon: "folder", label: "my-project/", type: "dir", info: "Root of the entire project. Contains three sibling directories: frontend, backend, and ansible. The ansible directory sits alongside your app code — not inside it.", title: "Project root" },

  { indent: "│\n", icon: "", label: "", type: "spacer" },
  { indent: "├── ", icon: "folder", label: "frontend/", type: "dir-green", info: "Your React / Vue / Next.js app. Completely separate from Ansible — it has its own package.json, src/, and build output. Ansible will deploy the built output to your servers.", title: "Frontend app" },
  { indent: "│   ├── ", icon: "file", label: "package.json", type: "file-green", info: "Node dependencies and build scripts. Ansible can run `npm install && npm run build` on the server as part of a deployment task.", title: "package.json", sampleId: "frontend/package.json" },
  { indent: "│   ├── ", icon: "folder", label: "src/", type: "dir-green", info: "Your React/Vue component source. Ansible doesn't touch this directly — it deploys the compiled output from dist/ or build/.", title: "Source files" },
  { indent: "│   ├── ", icon: "folder", label: "dist/", type: "dir-green", info: "Compiled frontend output (after npm run build). Ansible copies this folder to the nginx web root on your servers using the `copy` or `synchronize` module.", title: "Built output" },
  { indent: "│   └── ", icon: "file", label: ".env.example", type: "file-green", info: "Example environment file committed to git. Ansible uses a Jinja2 template (ansible/roles/frontend/templates/.env.j2) to render and deploy the real .env with actual secrets from Ansible Vault.", title: ".env.example", sampleId: "frontend/.env.example" },

  { indent: "│\n", icon: "", label: "", type: "spacer" },
  { indent: "├── ", icon: "folder", label: "backend/", type: "dir-blue", info: "Your Python / Node.js / Go API. Ansible deploys this by cloning the repo, installing dependencies, and managing the systemd service that keeps it running.", title: "Backend app" },
  { indent: "│   ├── ", icon: "file", label: "requirements.txt", type: "file-blue", info: "Python dependencies. Ansible installs these on the server with: `pip: requirements=/var/www/app/requirements.txt`", title: "requirements.txt", sampleId: "backend/requirements.txt" },
  { indent: "│   ├── ", icon: "folder", label: "src/", type: "dir-blue", info: "Your API source code. Ansible clones the whole repo to the server using the `git` module, not just this folder.", title: "API source" },
  { indent: "│   ├── ", icon: "file", label: "Dockerfile", type: "file-blue", info: "Optional: if you containerise, Ansible can run `docker-compose up -d` using the `community.docker.docker_compose` module after deploying.", title: "Dockerfile", sampleId: "backend/Dockerfile" },
  { indent: "│   └── ", icon: "file", label: ".env.example", type: "file-blue", info: "Same pattern as frontend — Ansible renders the real .env from a Jinja2 template with secrets loaded from Ansible Vault.", title: ".env.example", sampleId: "backend/.env.example" },

  { indent: "│\n", icon: "", label: "", type: "spacer" },
  { indent: "└── ", icon: "folder", label: "ansible/", type: "dir-ansible", info: "The entire Ansible project lives here, as a sibling to frontend/ and backend/. This is the standard convention — infrastructure code alongside app code in the same repo (a 'monorepo' approach).", title: "Ansible root" },

  { indent: "    ├── ", icon: "file", label: "ansible.cfg", type: "ansible-file", info: "The Ansible configuration file. Sets defaults like: inventory path, remote user, SSH key, roles path, vault password file. Ansible reads this automatically when you run from the ansible/ directory.", title: "ansible.cfg", sampleId: "ansible.cfg" },

  { indent: "    │\n", icon: "", label: "", type: "spacer" },
  { indent: "    ├── ", icon: "folder", label: "inventories/", type: "ansible", info: "Separating inventories by environment is best practice. You have a different inventory for staging vs production — different IPs, different variables, same playbooks.", title: "Inventories" },
  { indent: "    │   ├── ", icon: "folder", label: "production/", type: "ansible", info: "All production-specific host and variable definitions live here.", title: "Production env" },
  { indent: "    │   │   ├── ", icon: "file", label: "hosts.ini", type: "ansible-file", info: "Lists your real production server IPs/hostnames grouped by role:\n[webservers]\n10.0.1.10\n10.0.1.11\n\n[databases]\n10.0.2.10", title: "Production hosts", sampleId: "inventories/production/hosts.ini" },
  { indent: "    │   │   ├── ", icon: "folder", label: "group_vars/", type: "ansible", info: "Variables scoped to host groups in production. Any host in [webservers] automatically gets the variables defined in group_vars/webservers.yml.", title: "Production group vars" },
  { indent: "    │   │   │   ├── ", icon: "file", label: "all.yml", type: "ansible-file", info: "Variables that apply to EVERY host in production:\nenv: production\ndomain: myapp.com\ndeploy_user: deploy", title: "group_vars/all.yml", sampleId: "inventories/production/group_vars/all.yml" },
  { indent: "    │   │   │   ├── ", icon: "file", label: "webservers.yml", type: "ansible-file", info: "Variables only for hosts in the [webservers] group:\nhttp_port: 80\nnginx_workers: 4\napp_dir: /var/www/myapp", title: "group_vars/webservers.yml", sampleId: "inventories/production/group_vars/webservers.yml" },
  { indent: "    │   │   │   └── ", icon: "file", label: "databases.yml", type: "ansible-file", info: "Variables only for hosts in the [databases] group:\npostgres_version: 15\nmax_connections: 200\ndb_name: myapp_prod", title: "group_vars/databases.yml", sampleId: "inventories/production/group_vars/databases.yml" },
  { indent: "    │   │   └── ", icon: "folder", label: "host_vars/", type: "ansible", info: "Variables scoped to a SINGLE specific host. Overrides group_vars for that host. Use when one server needs a different setting than the rest of its group.", title: "Production host vars" },
  { indent: "    │   │       └── ", icon: "file", label: "web1.example.com.yml", type: "ansible-file", info: "Per-host override for web1 only:\nnginx_workers: 8  # this server has more CPUs\nbackup_node: true\nThis overrides the value from group_vars/webservers.yml for this host only.", title: "host_vars/web1.yml", sampleId: "inventories/production/host_vars/web1.example.com.yml" },

  { indent: "    │   └── ", icon: "folder", label: "staging/", type: "ansible", info: "Identical structure to production/ but with staging server IPs and different variable values (e.g. env: staging, smaller instance sizes, test domain).", title: "Staging env" },
  { indent: "    │       ├── ", icon: "file", label: "hosts.ini", type: "ansible-file", info: "Staging server IPs — usually fewer servers, smaller machines.", title: "Staging hosts", sampleId: "inventories/staging/hosts.ini" },
  { indent: "    │       └── ", icon: "folder", label: "group_vars/", type: "ansible", info: "Same structure as production group_vars but with staging values:\nenv: staging\ndomain: staging.myapp.com", title: "Staging group vars" },
  { indent: "    │           └── ", icon: "file", label: "all.yml", type: "ansible-file", info: "Staging-wide variables that differ from production.", title: "staging/group_vars/all.yml", sampleId: "inventories/staging/group_vars/all.yml" },

  { indent: "    │\n", icon: "", label: "", type: "spacer" },
  { indent: "    ├── ", icon: "folder", label: "playbooks/", type: "ansible", info: "Top-level playbooks. Each one describes a complete operation. They import roles to do the actual work. Think of these as the entry points you actually run.", title: "Playbooks" },
  { indent: "    │   ├── ", icon: "file", label: "site.yml", type: "ansible-file", info: "The master playbook. Runs everything — provisions servers, deploys frontend, deploys backend. Run for a full environment setup:\nansible-playbook playbooks/site.yml -i inventories/production/", title: "site.yml — master", sampleId: "playbooks/site.yml" },
  { indent: "    │   ├── ", icon: "file", label: "deploy.yml", type: "ansible-file", info: "Deploy-only playbook. Doesn't reprovision — just pulls latest code, installs deps, restarts services. Used for day-to-day deploys:\nansible-playbook playbooks/deploy.yml -i inventories/production/", title: "deploy.yml", sampleId: "playbooks/deploy.yml" },
  { indent: "    │   ├── ", icon: "file", label: "provision.yml", type: "ansible-file", info: "First-time server setup: installs system packages, creates users, configures firewall, sets up nginx. Run once when you spin up a new server.", title: "provision.yml", sampleId: "playbooks/provision.yml" },
  { indent: "    │   └── ", icon: "file", label: "rollback.yml", type: "ansible-file", info: "Rolls back to the previous release. Uses the `git` module to check out the previous commit tag and restarts services.", title: "rollback.yml", sampleId: "playbooks/rollback.yml" },

  { indent: "    │\n", icon: "", label: "", type: "spacer" },
  { indent: "    ├── ", icon: "folder", label: "roles/", type: "ansible", info: "Roles are the reusable building blocks. Each role is a self-contained bundle of tasks, handlers, templates, and variables for one concern. Playbooks call roles.", title: "Roles" },

  { indent: "    │   ├── ", icon: "folder", label: "common/", type: "ansible", info: "Runs on every server. Sets up the basics: system users, SSH hardening, unattended upgrades, common packages (curl, git, htop). Called first in site.yml.", title: "common role" },
  { indent: "    │   │   ├── ", icon: "folder", label: "tasks/", type: "ansible", info: "Task files for the common role." },
  { indent: "    │   │   │   └── ", icon: "file", label: "main.yml", type: "ansible-file", info: "The tasks entry point for the common role. Ansible always auto-loads tasks/main.yml first when a role is called.", title: "common/tasks/main.yml", sampleId: "roles/common/tasks/main.yml" },
  { indent: "    │   │   ├── ", icon: "folder", label: "handlers/", type: "ansible", info: "Handler files for the common role." },
  { indent: "    │   │   │   └── ", icon: "file", label: "main.yml", type: "ansible-file", info: "Handlers for the common role. E.g.: 'Restart sshd' — triggered when the SSH config file changes.", title: "common/handlers/main.yml", sampleId: "roles/common/handlers/main.yml" },
  { indent: "    │   │   └── ", icon: "folder", label: "defaults/", type: "ansible", info: "Default variables for the common role." },
  { indent: "    │   │       └── ", icon: "file", label: "main.yml", type: "ansible-file", info: "Default variable values for the common role. Lowest priority — easily overridden by group_vars or host_vars.", title: "common/defaults/main.yml", sampleId: "roles/common/defaults/main.yml" },

  { indent: "    │   ├── ", icon: "folder", label: "webserver/", type: "ansible", info: "Installs and configures nginx. Manages the nginx service. Renders nginx.conf from a Jinja2 template with your domain and port variables.", title: "webserver role" },
  { indent: "    │   │   ├── ", icon: "file", label: "tasks/main.yml", type: "ansible-file-flat", info: "Tasks: install nginx, enable service, deploy config. Notifies 'Reload nginx' handler when config changes.", title: "webserver tasks", sampleId: "roles/webserver/tasks/main.yml" },
  { indent: "    │   │   ├── ", icon: "file", label: "handlers/main.yml", type: "ansible-file-flat", info: "Handlers: 'Reload nginx' (graceful reload), 'Restart nginx' (full restart). Only run if notified.", title: "webserver handlers", sampleId: "roles/webserver/handlers/main.yml" },
  { indent: "    │   │   └── ", icon: "folder", label: "templates/", type: "ansible", info: "Jinja2 templates rendered with your variables before being copied to the server." },
  { indent: "    │   │       └── ", icon: "file", label: "nginx.conf.j2", type: "ansible-file", info: "The nginx config template. Uses variables like:\nserver_name {{ domain }};\nlisten {{ http_port }};\nroot /var/www/{{ app_name }};\nAnsible renders this and copies the result to /etc/nginx/nginx.conf.", title: "nginx.conf.j2", sampleId: "roles/webserver/templates/nginx.conf.j2" },

  { indent: "    │   ├── ", icon: "folder", label: "backend/", type: "ansible", info: "Deploys the backend API. Clones the repo, installs Python deps, renders .env from template, manages the systemd service.", title: "backend role" },
  { indent: "    │   │   ├── ", icon: "file", label: "tasks/main.yml", type: "ansible-file-flat", info: "Tasks: git clone, pip install, template .env, systemctl enable+start. Notifies 'Restart backend' if code or .env changed.", title: "backend tasks", sampleId: "roles/backend/tasks/main.yml" },
  { indent: "    │   │   ├── ", icon: "file", label: "handlers/main.yml", type: "ansible-file-flat", info: "'Restart backend' handler: restarts the systemd service. Only runs if notified — so it doesn't restart on every deploy if nothing changed.", title: "backend handlers", sampleId: "roles/backend/handlers/main.yml" },
  { indent: "    │   │   ├── ", icon: "folder", label: "templates/", type: "ansible", info: "Jinja2 templates for the backend." },
  { indent: "    │   │   │   └── ", icon: "file", label: ".env.j2", type: "ansible-file", info: "Renders the real .env file with secrets from Ansible Vault:\nDATABASE_URL={{ db_url }}\nSECRET_KEY={{ secret_key }}\nAnsible Vault encrypts db_url and secret_key — they're decrypted at deploy time.", title: ".env.j2 template", sampleId: "roles/backend/templates/.env.j2" },
  { indent: "    │   │   └── ", icon: "folder", label: "files/", type: "ansible", info: "Static files deployed as-is (no templating). E.g. a systemd .service unit file for your backend process." },
  { indent: "    │   │       └── ", icon: "file", label: "myapp.service", type: "ansible-file", info: "The systemd unit file for your backend. Copied as-is to /etc/systemd/system/. Defines how systemd starts, stops, and restarts your app.", title: "myapp.service", sampleId: "roles/backend/files/myapp.service" },

  { indent: "    │   └── ", icon: "folder", label: "frontend/", type: "ansible", info: "Deploys the built frontend. Copies dist/ to the nginx web root. Renders the frontend .env if needed.", title: "frontend role" },
  { indent: "    │       ├── ", icon: "file", label: "tasks/main.yml", type: "ansible-file-flat", info: "Tasks: synchronize dist/ to /var/www/html, set permissions, optionally run npm build on the server.", title: "frontend tasks", sampleId: "roles/frontend/tasks/main.yml" },
  { indent: "    │       └── ", icon: "file", label: "templates/.env.j2", type: "ansible-file-flat", info: "Frontend .env template — injects public env vars like VITE_API_URL={{ api_url }} before the build or at deploy time.", title: "frontend .env.j2", sampleId: "roles/frontend/templates/.env.j2" },

  { indent: "    │\n", icon: "", label: "", type: "spacer" },
  { indent: "    ├── ", icon: "folder", label: "group_vars/", type: "ansible", info: "A second group_vars location — at the ansible/ root level, not inside inventories/. Used for variables that are the SAME across all environments (production + staging). Environment-specific ones live inside inventories/production/group_vars/.", title: "Shared group vars" },
  { indent: "    │   └── ", icon: "file", label: "all.yml", type: "ansible-file", info: "Variables shared across every environment and every host:\napp_name: myapp\nrepo_url: https://github.com/you/myapp.git\ndeploy_dir: /var/www\nThese never change between staging and production.", title: "Shared all.yml", sampleId: "group_vars/all.yml" },

  { indent: "    │\n", icon: "", label: "", type: "spacer" },
  { indent: "    └── ", icon: "folder", label: "vault/", type: "ansible", info: "Encrypted secrets, managed with ansible-vault. These files are safe to commit to git — the contents are encrypted. Never store plaintext secrets anywhere in this tree.", title: "Vault (secrets)" },
  { indent: "        ├── ", icon: "file", label: "secrets.yml", type: "ansible-file", info: "Encrypted with ansible-vault. Contains:\ndb_password: !vault |\n  $ANSIBLE_VAULT;1.1;AES256\n  ...(gibberish)...\nDecrypted at runtime with --ask-vault-pass or a vault password file.", title: "secrets.yml (encrypted)", sampleId: "vault/secrets.yml" },
  { indent: "        └── ", icon: "file", label: ".vault_pass", type: "file-amber", info: "The vault password file — listed in .gitignore, NEVER committed. Referenced in ansible.cfg:\nvault_password_file = vault/.vault_pass\nSo you don't have to type --ask-vault-pass every time.", title: ".vault_pass (gitignored!)" },
];

function getColors(type) {
  if (type === 'dir-green') return { icon: '#3B6D11', label: '#3B6D11' };
  if (type === 'file-green') return { icon: '#639922', label: '#3B6D11' };
  if (type === 'dir-blue') return { icon: '#185FA5', label: '#185FA5' };
  if (type === 'file-blue') return { icon: '#378ADD', label: '#185FA5' };
  if (type === 'dir-ansible' || type === 'ansible') return { icon: '#534AB7', label: '#534AB7' };
  if (type === 'ansible-file' || type === 'ansible-file-flat') return { icon: '#7F77DD', label: '#7F77DD' };
  if (type === 'file-amber') return { icon: '#BA7517', label: '#854F0B' };
  return { icon: 'var(--color-text-secondary)', label: 'var(--color-text-secondary)' };
}

function getIconChar(icon) {
  if (icon === 'folder') return '📁';
  if (icon === 'file') return '📄';
  return '';
}
