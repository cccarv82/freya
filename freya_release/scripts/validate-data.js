const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// --- Validation Helpers ---

function validateTaskLog(json, file) {
  const errors = [];
  if (!Array.isArray(json.tasks)) {
    errors.push(`Root must have 'tasks' array.`);
    return errors;
  }

  json.tasks.forEach((task, index) => {
    if (!task.id) errors.push(`Task[${index}] missing 'id'.`);
    if (!task.description) errors.push(`Task[${index}] missing 'description'.`);
    if (!task.category) errors.push(`Task[${index}] missing 'category'.`);
    if (!task.status) errors.push(`Task[${index}] missing 'status'.`);
    if (!task.createdAt) errors.push(`Task[${index}] missing 'createdAt'.`);

    const validCategories = ['DO_NOW', 'SCHEDULE', 'DELEGATE', 'IGNORE'];
    if (task.category && !validCategories.includes(task.category)) {
        errors.push(`Task[${index}] invalid category '${task.category}'.`);
    }

    const validStatuses = ['PENDING', 'COMPLETED', 'ARCHIVED'];
    if (task.status && !validStatuses.includes(task.status)) {
        errors.push(`Task[${index}] invalid status '${task.status}'.`);
    }
  });

  return errors;
}

function validateCareerLog(json, file) {
  const errors = [];
  if (!Array.isArray(json.entries)) {
    errors.push(`Root must have 'entries' array.`);
    return errors;
  }

  json.entries.forEach((entry, index) => {
    if (!entry.id) errors.push(`Entry[${index}] missing 'id'.`);
    if (!entry.date) errors.push(`Entry[${index}] missing 'date'.`);
    if (!entry.type) errors.push(`Entry[${index}] missing 'type'.`);
    if (!entry.description) errors.push(`Entry[${index}] missing 'description'.`);

    const validTypes = ['Achievement', 'Feedback', 'Certification', 'Goal'];
    if (entry.type && !validTypes.includes(entry.type)) {
        errors.push(`Entry[${index}] invalid type '${entry.type}'.`);
    }
  });

  return errors;
}

function validateProjectStatus(json, file) {
  const errors = [];
  const requiredFields = ['client', 'project', 'active', 'currentStatus', 'lastUpdated', 'history'];
  
  requiredFields.forEach(field => {
      if (json[field] === undefined) errors.push(`Missing field '${field}'.`);
  });

  if (Array.isArray(json.history)) {
      json.history.forEach((item, index) => {
          if (!item.date) errors.push(`History[${index}] missing 'date'.`);
          if (!item.type) errors.push(`History[${index}] missing 'type'.`);
          if (!item.content) errors.push(`History[${index}] missing 'content'.`);
      });
  } else if (json.history !== undefined) {
      errors.push(`'history' must be an array.`);
  }

  return errors;
}

// --- Main Logic ---

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, fileList);
    } else {
      if (path.extname(file) === '.json') {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

function validateData() {
  console.log('🔍 Starting validation...');
  try {
    if (!fs.existsSync(DATA_DIR)) {
      console.error('❌ Data directory not found:', DATA_DIR);
      process.exit(1);
    }

    const files = walk(DATA_DIR);
    console.log(`Found ${files.length} json files.`);
    
    let errorCount = 0;

    files.forEach(file => {
        const relativePath = path.relative(DATA_DIR, file);
        let content;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch (readErr) {
            console.error(`❌ [${relativePath}] Read failed: ${readErr.message}`);
            errorCount++;
            return;
        }

        let json;
        try {
            json = JSON.parse(content);
        } catch (parseErr) {
            console.error(`❌ [${relativePath}] JSON parse failed: ${parseErr.message}`);
            errorCount++;
            return;
        }

        let fileErrors = [];

        // Route validation based on filename/path
        if (file.endsWith('task-log.json')) {
            fileErrors = validateTaskLog(json, relativePath);
        } else if (file.endsWith('career-log.json')) {
            fileErrors = validateCareerLog(json, relativePath);
        } else if (file.endsWith('status.json')) {
            fileErrors = validateProjectStatus(json, relativePath);
        } else {
            // Optional: warn about unknown files, or ignore
            // console.warn(`⚠️ [${relativePath}] Unknown JSON file type. Skipping schema validation.`);
        }

        if (fileErrors.length > 0) {
            console.error(`❌ [${relativePath}] Validation failed:`);
            fileErrors.forEach(e => console.error(`   - ${e}`));
            errorCount++;
        }
    });

    if (errorCount === 0) {
        console.log('✅ All systems operational');
    } else {
        console.error(`❌ Validation completed with errors in ${errorCount} file(s).`);
        process.exit(1);
    }

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

validateData();
