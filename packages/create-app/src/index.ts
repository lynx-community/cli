#!/usr/bin/env node

import * as p from '@clack/prompts';
import { Command } from 'commander';
import fs from 'fs-extra';
import gradient from 'gradient-string';
import path from 'path';
import pc from 'picocolors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function detectPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent || '';

  if (userAgent.startsWith('yarn')) return 'yarn';
  if (userAgent.startsWith('pnpm')) return 'pnpm';
  if (userAgent.startsWith('bun')) return 'bun';

  const execPath = process.env.npm_execpath || '';
  if (execPath.includes('yarn')) return 'yarn';
  if (execPath.includes('pnpm')) return 'pnpm';
  if (execPath.includes('bun')) return 'bun';

  return 'npm';
}

interface AppConfig {
  name: string;
  platforms: string[];
  directory: string;
}

// Helper functions for string transformations
function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\s/g, '');
}

function toLowerKebabCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toValidJavaPackageName(str: string): string {
  // Java package names must start with a letter, contain only letters, numbers, and dots
  // and each segment must be a valid Java identifier
  let packageName = str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric characters
    .replace(/^[0-9]+/, ''); // Remove leading numbers

  // Ensure it's not empty and starts with a letter
  if (!packageName || !/^[a-z]/.test(packageName)) {
    packageName = `app${packageName}`;
  }

  return packageName;
}

async function replaceTemplateStrings(
  projectPath: string,
  projectName: string,
): Promise<void> {
  const pascalCaseName = toPascalCase(projectName);
  const kebabCaseName = toLowerKebabCase(projectName);
  const javaPackageName = toValidJavaPackageName(projectName);

  console.log(`🔄 Replacing template strings:`);
  console.log(`  Project name: ${projectName}`);
  console.log(`  PascalCase: ${pascalCaseName}`);
  console.log(`  kebab-case: ${kebabCaseName}`);
  console.log(`  Java package: ${javaPackageName}`);

  // Define replacements
  const replacements = [
    { from: /HelloWorld/g, to: pascalCaseName },
    { from: /helloworld/g, to: javaPackageName },
    { from: /com\.helloworld/g, to: `com.${javaPackageName}` },
    { from: /com\.lynx\.kotlinemptyproject/g, to: `com.${javaPackageName}` }, // Fix hardcoded test package
    { from: /com\.example\.HelloWorld/g, to: `com.example.${pascalCaseName}` },
    { from: /Theme\.HelloWorld/g, to: `Theme.${pascalCaseName}` },
    { from: /"HelloWorld"/g, to: `"${kebabCaseName}"` }, // For package.json name
  ];

  // Files that need string replacement (exclude binary files)
  const filesToProcess = await getFilesRecursively(projectPath);
  const textFiles = filesToProcess.filter((file) => isTextFile(file));

  // Check if critical Gradle files exist before processing
  const criticalGradleFiles = [
    path.join(projectPath, 'android', 'build.gradle.kts'),
    path.join(projectPath, 'android', 'app', 'build.gradle.kts'),
  ];

  for (const gradleFile of criticalGradleFiles) {
    if (await fs.pathExists(gradleFile)) {
      console.log(
        `  ✅ Found critical Gradle file: ${path.relative(projectPath, gradleFile)}`,
      );
    } else {
      console.log(
        `  ❌ Missing critical Gradle file: ${path.relative(projectPath, gradleFile)}`,
      );
    }
  }

  for (const filePath of textFiles) {
    try {
      let content = await fs.readFile(filePath, 'utf8');
      let modified = false;
      const isGradleFile = filePath.includes('build.gradle.kts');

      if (isGradleFile) {
        console.log(
          `  📝 Processing Gradle file: ${path.relative(projectPath, filePath)}`,
        );
      }

      for (const replacement of replacements) {
        if (replacement.from.test(content)) {
          content = content.replace(replacement.from, replacement.to);
          modified = true;

          if (isGradleFile) {
            console.log(
              `    📝 Applied replacement: ${replacement.from} → ${replacement.to}`,
            );
          }
        }
      }

      if (modified) {
        await fs.writeFile(filePath, content, 'utf8');
        if (isGradleFile) {
          console.log(`    ✅ Successfully updated Gradle file`);
        }
      }
    } catch (_error) {
      // Skip files that can't be read as text
      continue;
    }
  }

  // Verify critical Gradle files after processing
  console.log(`\n🔍 Verifying critical Gradle files after string replacement:`);
  for (const gradleFile of criticalGradleFiles) {
    if (await fs.pathExists(gradleFile)) {
      console.log(
        `  ✅ Gradle file exists: ${path.relative(projectPath, gradleFile)}`,
      );
    } else {
      console.log(
        `  ❌ Gradle file missing: ${path.relative(projectPath, gradleFile)}`,
      );
    }
  }
}

async function getFilesRecursively(dir: string): Promise<string[]> {
  const files: string[] = [];
  const items = await fs.readdir(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const subFiles = await getFilesRecursively(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function isTextFile(filePath: string): boolean {
  const binaryExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.bmp',
    '.ico',
    '.webp',
    '.jar',
    '.aar',
    '.so',
    '.a',
    '.dylib',
    '.dll',
    '.zip',
    '.tar',
    '.gz',
    '.rar',
    '.mp3',
    '.mp4',
    '.avi',
    '.mov',
    '.pdf',
    '.doc',
    '.docx',
    '.keystore',
  ];

  const ext = path.extname(filePath).toLowerCase();
  return !binaryExtensions.includes(ext);
}

async function renameTemplateFilesAndDirs(
  projectPath: string,
  projectName: string,
): Promise<void> {
  const pascalCaseName = toPascalCase(projectName);
  const javaPackageName = toValidJavaPackageName(projectName);

  console.log(`🔄 Renaming directories and files:`);
  console.log(`  Java package directories: helloworld -> ${javaPackageName}`);

  // First, rename Java package directories (most important for Android)
  await renameJavaPackageDirectories(projectPath, javaPackageName);

  // Then rename other files and directories that contain HelloWorld
  const itemsToRename = await getItemsToRename(projectPath);

  // Sort by depth (deepest first) to avoid conflicts when renaming parent directories
  itemsToRename.sort(
    (a, b) => b.split(path.sep).length - a.split(path.sep).length,
  );

  for (const itemPath of itemsToRename) {
    const dirname = path.dirname(itemPath);
    const basename = path.basename(itemPath);

    // Skip critical build files that should not be renamed
    if (
      basename === 'build.gradle.kts' ||
      basename === 'settings.gradle.kts' ||
      basename === 'gradle.properties' ||
      basename.startsWith('gradlew')
    ) {
      continue;
    }

    if (basename.includes('HelloWorld')) {
      const newBasename = basename.replace(/HelloWorld/g, pascalCaseName);
      const newPath = path.join(dirname, newBasename);

      console.log(
        `  📁 Renaming: ${path.relative(projectPath, itemPath)} → ${path.basename(newPath)}`,
      );

      if ((await fs.pathExists(itemPath)) && !(await fs.pathExists(newPath))) {
        await fs.move(itemPath, newPath);
        console.log(`    ✅ Successfully renamed`);
      } else if (await fs.pathExists(newPath)) {
        console.log(`    ⚠️  Target already exists: ${newPath}`);
      }
    }
  }
}

async function renameJavaPackageDirectories(
  projectPath: string,
  lowerCaseName: string,
): Promise<void> {
  // Find all Java source directories that contain 'helloworld' package structure
  const javaSourcePaths = [
    'android/app/src/main/java',
    'android/app/src/test/java',
    'android/app/src/androidTest/java',
  ];

  for (const javaSourcePath of javaSourcePaths) {
    const fullJavaPath = path.join(projectPath, javaSourcePath);
    if (await fs.pathExists(fullJavaPath)) {
      await renamePackageInDirectory(fullJavaPath, lowerCaseName);
    }
  }
}

async function renamePackageInDirectory(
  javaSourceDir: string,
  newPackageName: string,
): Promise<void> {
  // Look for com/helloworld directory structure
  const comPath = path.join(javaSourceDir, 'com');
  console.log(`    Checking ${comPath}`);

  if (await fs.pathExists(comPath)) {
    const helloworldPath = path.join(comPath, 'helloworld');
    const lynxHelloworldPath = path.join(comPath, 'lynx', 'helloworld');

    // Handle com/helloworld -> com/newPackageName
    if (await fs.pathExists(helloworldPath)) {
      const newPackagePath = path.join(comPath, newPackageName);
      console.log(`    Renaming: ${helloworldPath} -> ${newPackagePath}`);
      if (!(await fs.pathExists(newPackagePath))) {
        await fs.move(helloworldPath, newPackagePath);
        console.log(`    ✅ Successfully renamed Java package directory`);
      } else {
        console.log(
          `    ⚠️  Target directory already exists: ${newPackagePath}`,
        );
      }
    } else {
      console.log(`    ❌ Source directory not found: ${helloworldPath}`);
    }

    // Handle com/lynx/helloworld -> com/newPackageName (fix incorrect directory structure)
    // The test files should be in the same package as the main app
    if (await fs.pathExists(lynxHelloworldPath)) {
      const newPackagePath = path.join(comPath, newPackageName);
      if (await fs.pathExists(newPackagePath)) {
        // If target exists, move files individually
        const files = await fs.readdir(lynxHelloworldPath);
        for (const file of files) {
          const sourcePath = path.join(lynxHelloworldPath, file);
          const targetPath = path.join(newPackagePath, file);
          if (!(await fs.pathExists(targetPath))) {
            await fs.move(sourcePath, targetPath);
          }
        }
        // Remove the now-empty lynx/helloworld directory
        await fs.remove(lynxHelloworldPath);
        // Also try to remove lynx directory if it's empty
        const lynxPath = path.join(comPath, 'lynx');
        try {
          const lynxContents = await fs.readdir(lynxPath);
          if (lynxContents.length === 0) {
            await fs.remove(lynxPath);
          }
        } catch (_error) {
          // Directory might not exist or not be empty, that's fine
        }
      } else {
        // Target doesn't exist, just move the whole directory
        await fs.move(lynxHelloworldPath, newPackagePath);
      }
    }
  }
}

async function getItemsToRename(dir: string): Promise<string[]> {
  const items: string[] = [];

  try {
    const dirItems = await fs.readdir(dir);

    for (const item of dirItems) {
      const fullPath = path.join(dir, item);
      const stat = await fs.stat(fullPath);

      // Add current item to the list
      items.push(fullPath);

      // If it's a directory, recursively get its contents
      if (stat.isDirectory()) {
        const subItems = await getItemsToRename(fullPath);
        items.push(...subItems);
      }
    }
  } catch (_error) {
    // Skip directories that can't be read
  }

  return items;
}

export async function createApp(): Promise<void> {
  const brandGradient = gradient(['#ff6b9d', '#45b7d1']);
  const title = pc.bold(`Create ${brandGradient('Lynx')} App`);

  p.intro(title);

  const program = new Command();

  program
    .name('create-lynx-app')
    .description('Create a new Lynx application')
    .version('0.1.0')
    .argument('[project-name]', 'Name of the project')
    .option('-p, --platforms <platforms...>', 'Platforms to include')
    .option('-d, --directory <directory>', 'Target directory')
    .action(
      async (
        projectName?: string,
        options?: { platforms?: string[]; directory?: string },
      ) => {
        try {
          const config = await gatherProjectInfo(projectName, options);
          await scaffoldProject(config);

          const packageManager = detectPackageManager();
          const installCmd =
            packageManager === 'yarn' ? 'yarn' : `${packageManager} install`;
          const devCmd =
            packageManager === 'yarn' ? 'yarn dev' : `${packageManager} dev`;

          p.outro(pc.cyan('Happy hacking!'));
          console.log(pc.white(`Next steps:`));
          console.log(pc.gray(`  cd ${config.name}`));
          console.log(pc.gray(`  ${installCmd}`));
          console.log(pc.gray(`  ${devCmd}`));
        } catch (error) {
          if (error instanceof Error && error.message === 'cancelled') {
            p.cancel('Operation cancelled.');
            process.exit(0);
          }
          p.cancel(pc.red('❌ Error creating project: ' + error));
          process.exit(1);
        }
      },
    );

  await program.parseAsync();
}

async function gatherProjectInfo(
  projectName?: string,
  options?: { platforms?: string[]; directory?: string },
): Promise<AppConfig> {
  let name = projectName;
  let platforms = options?.platforms;

  if (!name) {
    const nameResult = await p.text({
      message: 'What is your app named?',
      placeholder: 'my-lynx-app',
      validate: (value) => {
        if (!value.trim()) return 'App name is required';
        if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
          return 'App name should only contain letters, numbers, hyphens, and underscores';
        }
      },
    });

    if (p.isCancel(nameResult)) {
      throw new Error('cancelled');
    }

    name = nameResult;
  }

  if (!platforms || platforms.length === 0) {
    const platformsResult = await p.multiselect({
      message: 'What platforms do you want to start with?',
      options: [
        { value: 'ios', label: 'iOS' },
        { value: 'android', label: 'Android' },
        { value: 'harmonyos', label: 'HarmonyOS' },
      ],
      initialValues: ['ios', 'android'],
      required: true,
    });

    if (p.isCancel(platformsResult)) {
      throw new Error('cancelled');
    }

    platforms = platformsResult as string[];
  }

  return {
    name: name as string,
    platforms: platforms as string[],
    directory: options?.directory || process.cwd(),
  };
}

async function scaffoldProject(config: AppConfig): Promise<void> {
  const targetPath = path.join(config.directory, config.name);

  const spinner = p.spinner();
  spinner.start(`Creating project in ${targetPath}`);

  if (await fs.pathExists(targetPath)) {
    spinner.stop();
    throw new Error(`Directory ${targetPath} already exists`);
  }

  // Use bundled template from templates directory
  const templatePath = path.join(__dirname, '../templates/helloworld');

  if (!(await fs.pathExists(templatePath))) {
    spinner.stop();
    throw new Error(
      `Template not found at ${templatePath}. Please ensure the helloworld template exists.`,
    );
  }

  spinner.message('Copying template files...');
  await fs.copy(templatePath, targetPath, {
    filter: (src) => {
      const relativePath = path.relative(templatePath, src);
      
      // Log critical gradle files being processed
      if (relativePath.includes('build.gradle.kts') || relativePath.includes('settings.gradle.kts')) {
        console.log(`  📋 Processing build file: ${relativePath}`);
      }

      // Skip build artifacts and dependencies but preserve build configuration files
      if (
        relativePath.includes('node_modules') ||
        relativePath.includes('dist') ||
        relativePath.includes('.git') ||
        relativePath.startsWith('apple/HelloWorld.xcodeproj/xcuserdata') ||
        relativePath.startsWith('apple/HelloWorld.xcworkspace/xcuserdata') ||
        relativePath.startsWith('android/app/build/') || // Fixed: only exclude build/ directory, not build.gradle.kts
        relativePath.startsWith('android/.gradle')
      ) {
        if (relativePath.includes('build.gradle.kts') || relativePath.includes('settings.gradle.kts')) {
          console.log(`  ❌ EXCLUDED build file: ${relativePath}`);
        }
        return false;
      }

      const platformSpecific = getPlatformSpecificFiles(relativePath);
      if (platformSpecific.length > 0) {
        const shouldInclude = platformSpecific.some((platform) =>
          config.platforms.includes(platform),
        );
        if (!shouldInclude && (relativePath.includes('build.gradle.kts') || relativePath.includes('settings.gradle.kts'))) {
          console.log(`  ❌ EXCLUDED by platform filter: ${relativePath} (platforms: ${platformSpecific.join(', ')})`);
        }
        return shouldInclude;
      }

      if (relativePath.includes('build.gradle.kts') || relativePath.includes('settings.gradle.kts')) {
        console.log(`  ✅ INCLUDED build file: ${relativePath}`);
      }
      return true;
    },
  });

  spinner.message('Configuring project files...');

  // Replace template strings throughout the project
  await replaceTemplateStrings(targetPath, config.name);

  // Rename directories and files that contain HelloWorld
  await renameTemplateFilesAndDirs(targetPath, config.name);

  console.log(`\n🔍 Final verification of Android project structure:`);

  // Check Java packages
  const androidJavaMainPath = path.join(
    targetPath,
    'android/app/src/main/java/com',
  );
  if (await fs.pathExists(androidJavaMainPath)) {
    const javaDirs = await fs.readdir(androidJavaMainPath);
    console.log(`  ✅ Java packages: ${javaDirs.join(', ')}`);
  } else {
    console.log(
      `  ❌ Android Java directory not found: ${androidJavaMainPath}`,
    );
  }

  // Final check of critical Gradle files
  const criticalFiles = [
    'android/build.gradle.kts',
    'android/app/build.gradle.kts',
    'android/settings.gradle.kts',
  ];

  for (const file of criticalFiles) {
    const filePath = path.join(targetPath, file);
    if (await fs.pathExists(filePath)) {
      const stats = await fs.stat(filePath);
      console.log(`  ✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`  ❌ ${file} - MISSING!`);
    }
  }

  await cleanupUnselectedPlatforms(targetPath, config.platforms);

  spinner.stop('Project created successfully!');
}

function getPlatformSpecificFiles(relativePath: string): string[] {
  const platforms: string[] = [];

  if (
    relativePath.startsWith('apple/') ||
    relativePath.includes('.swift') ||
    relativePath.includes('.xcodeproj') ||
    relativePath.includes('.xcworkspace')
  ) {
    platforms.push('ios');
  }

  if (
    relativePath.startsWith('android/') ||
    relativePath.includes('.gradle') ||
    relativePath.includes('.kt')
  ) {
    platforms.push('android');
  }

  return platforms;
}

async function cleanupUnselectedPlatforms(
  targetPath: string,
  selectedPlatforms: string[],
): Promise<void> {
  if (!selectedPlatforms.includes('ios')) {
    const applePath = path.join(targetPath, 'apple');
    if (await fs.pathExists(applePath)) {
      await fs.remove(applePath);
    }
  }

  if (!selectedPlatforms.includes('android')) {
    const androidPath = path.join(targetPath, 'android');
    if (await fs.pathExists(androidPath)) {
      await fs.remove(androidPath);
    }
  }

  // Add more platform cleanup logic as needed
}
