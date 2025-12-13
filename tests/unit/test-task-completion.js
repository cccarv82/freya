const fs = require('fs');
const path = require('path');

const taskLogPath = path.join(__dirname, 'temp-task-log.json');

// Mock Data
const initialData = {
  tasks: [
    { id: "1a2b", description: "Pagar boleto da internet", category: "DO_NOW", status: "PENDING", createdAt: "2023-10-27T10:00:00Z" },
    { id: "3c4d", description: "Comprar leite", category: "DO_NOW", status: "PENDING", createdAt: "2023-10-27T10:05:00Z" },
    { id: "5e6f", description: "Comprar pão", category: "DO_NOW", status: "PENDING", createdAt: "2023-10-27T10:10:00Z" },
    { id: "7g8h", description: "Ligar para João", category: "DELEGATE", status: "COMPLETED", createdAt: "2023-10-26T10:00:00Z", completedAt: "2023-10-26T12:00:00Z" }
  ]
};

// The Algorithm to be tested (Reference Implementation for Agent)
function completeTask(input, data) {
    const now = new Date().toISOString();
    let matches = [];

    // 1. Try Exact ID Match
    matches = data.tasks.filter(t => t.id === input);

    // 2. If no ID match, try Description Fuzzy Match (Substring, case-insensitive)
    if (matches.length === 0) {
        matches = data.tasks.filter(t => 
            t.description.toLowerCase().includes(input.toLowerCase()) && 
            t.status === 'PENDING' // Only match pending for text search to avoid confusion
        );
    }

    // 3. Handle Results
    if (matches.length === 0) {
        return { success: false, message: "Not found" };
    }
    if (matches.length > 1) {
        return { success: false, message: "Ambiguous", candidates: matches.map(m => m.id) };
    }

    // 4. Update
    const task = matches[0];
    if (task.status === 'COMPLETED') {
        return { success: true, message: "Already completed", task };
    }

    task.status = 'COMPLETED';
    task.completedAt = now;
    return { success: true, message: "Updated", task };
}

// Test Runner
try {
    console.log("Setting up test data...");
    
    // Test 1: Complete by ID
    let data = JSON.parse(JSON.stringify(initialData)); // Deep copy
    let result = completeTask("1a2b", data);
    if (!result.success || result.task.status !== 'COMPLETED') throw new Error("Test 1 Failed: ID match");
    console.log("✅ Test 1 Passed: Complete by ID");

    // Test 2: Complete by Name
    data = JSON.parse(JSON.stringify(initialData));
    result = completeTask("leite", data);
    if (!result.success || result.task.id !== '3c4d') throw new Error("Test 2 Failed: Name match");
    console.log("✅ Test 2 Passed: Complete by Name");

    // Test 3: Ambiguous Name
    data = JSON.parse(JSON.stringify(initialData));
    result = completeTask("Comprar", data); // Matches "Comprar leite" and "Comprar pão"
    if (result.success || result.message !== "Ambiguous") throw new Error("Test 3 Failed: Ambiguity check");
    console.log("✅ Test 3 Passed: Ambiguity Handling");

    // Test 4: Not Found
    data = JSON.parse(JSON.stringify(initialData));
    result = completeTask("Ferrari", data);
    if (result.success || result.message !== "Not found") throw new Error("Test 4 Failed: Not found check");
    console.log("✅ Test 4 Passed: Not Found Handling");

    console.log("🎉 All Logic Verification Tests Passed");

} catch (e) {
    console.error("❌ Test Failed:", e.message);
    process.exit(1);
}
