# create-lynx-app

A CLI tool to scaffold new Lynx applications.

## Usage

### Install and run directly with pnpm

```bash
pnpm create lynx-app my-app-name
```

### Or install globally

```bash
pnpm install -g create-lynx-app
create-lynx-app my-app-name
```

### Run locally during development

```bash
# From the create-app directory
pnpm build
node bin.js my-app-name
```

## Options

- `--template, -t`: Choose a template (`default`, `minimal`, `advanced`)
- `--directory, -d`: Specify target directory
- `--help, -h`: Show help
- `--version, -V`: Show version

## Examples

```bash
# Interactive mode
create-lynx-app

# With project name
create-lynx-app my-lynx-app

# With template
create-lynx-app my-lynx-app --template minimal

# In specific directory
create-lynx-app my-lynx-app --directory /path/to/projects
```

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Watch mode for development
pnpm dev

# Test the CLI
node bin.js --help
```
