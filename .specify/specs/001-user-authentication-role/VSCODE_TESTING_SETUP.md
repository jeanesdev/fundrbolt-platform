# VS Code Python Testing Setup Guide

**Status**: ✅ Configured for Phase 2

---

## Configuration Applied

I've configured VS Code to automatically discover and display your Python tests in the Testing sidebar.

### Settings Added to `.vscode/settings.json`:

```json
// Python Testing Configuration
"python.testing.pytestEnabled": true,
"python.testing.unittestEnabled": false,
"python.testing.pytestArgs": [
    "backend/app/tests",
    "-v",
    "--tb=short"
],
"python.testing.cwd": "${workspaceFolder}/backend",

// Python Environment - Poetry virtualenv
"python.defaultInterpreterPath": "/home/jjeanes/.cache/pypoetry/virtualenvs/fundrbolt-backend-koj7Cp7X-py3.12/bin/python",

// Python Formatting
"python.formatting.provider": "black",
"[python]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "ms-python.python"
}
```

---

## How to Use the Testing Sidebar

### 1. Open Testing Sidebar
- Click the **Testing icon** (flask icon) in the left Activity Bar
- Or press: `Ctrl+Shift+T` (Windows/Linux) or `Cmd+Shift+T` (Mac)

### 2. Refresh/Discover Tests
Once the sidebar opens, VS Code should automatically discover tests. If not:
- Click the **"Refresh Tests"** icon (circular arrow) at the top of the Testing sidebar
- Or run: **"Python: Discover Tests"** from Command Palette (`Ctrl+Shift+P`)

### 3. Run Tests
You should now see a tree structure:
```
📁 backend/app/tests
  📁 unit
    📄 test_infrastructure.py
      ⚙️ TestInfrastructure
        ▶️ test_config_loads
        ▶️ test_database_imports
        ▶️ test_redis_imports
        ... (4 more tests)
    📄 test_security.py
      ⚙️ TestPasswordHashing
        ▶️ test_hash_password_returns_string
        ▶️ test_verify_password_success
        ... (4 more tests)
      ⚙️ TestJWTTokens
        ▶️ test_create_access_token
        ... (5 more tests)
      ⚙️ TestVerificationToken
        ▶️ test_generate_verification_token
        ... (2 more tests)
```

### 4. Running Tests
- **Run All Tests**: Click "Run All Tests" button at top
- **Run Single Test**: Click the play icon (▶️) next to any test
- **Run Test Class**: Click play icon next to a class name
- **Run Test File**: Click play icon next to a file name
- **Debug Test**: Right-click any test → "Debug Test"

---

## Troubleshooting

### Tests Not Showing Up?

1. **Check Python Interpreter**:
   - Click Python version in bottom-left status bar
   - Select: `/home/jjeanes/.cache/pypoetry/virtualenvs/fundrbolt-backend-koj7Cp7X-py3.12/bin/python`

2. **Refresh Tests**:
   - Click the refresh icon in Testing sidebar
   - Or: Command Palette → "Python: Discover Tests"

3. **Check Output**:
   - Open: View → Output
   - Select: "Python Test Log" from dropdown
   - Look for any error messages

4. **Reload Window**:
   - Command Palette (`Ctrl+Shift+P`)
   - Run: "Developer: Reload Window"

### Tests Failing?

If tests work in terminal but fail in VS Code:
- **Working Directory**: Tests need to run from `backend/` folder (already configured)
- **Environment Variables**: Make sure `backend/.env` file exists
- **Dependencies**: Run `cd backend && poetry install` to ensure all deps are installed

---

## Running Tests in Terminal

You can still run tests in the terminal:

```bash
# Change to backend directory
cd backend

# Run all tests
poetry run pytest app/tests/ -v

# Run unit tests only
poetry run pytest app/tests/unit/ -v

# Run with coverage
poetry run pytest app/tests/ --cov=app --cov-report=term-missing

# Run specific test
poetry run pytest app/tests/unit/test_security.py::TestPasswordHashing::test_verify_password_success -v

# Run tests with specific marker
poetry run pytest -m unit -v
```

---

## VS Code Extensions Recommended

Make sure you have these extensions installed:
- ✅ **Python** (ms-python.python) - Required for testing
- ✅ **Pylance** (ms-python.vscode-pylance) - Language server
- 🔧 **Black Formatter** (optional, for formatting)
- 🔧 **Ruff** (optional, for linting)

Install via: Extensions sidebar (`Ctrl+Shift+X`) → Search → Install

---

## Test Coverage in VS Code

To see test coverage in the editor:

1. Install **Coverage Gutters** extension
2. Run tests with coverage: `poetry run pytest --cov=app --cov-report=xml`
3. Coverage will show as colored lines in the editor gutter

---

## Next Steps

✅ Tests are configured and ready!

After you:
1. Reload VS Code window (if needed)
2. Open Testing sidebar
3. Click "Refresh Tests"

You should see **22 tests** ready to run! 🎉

---

## Current Test Status

- **Total Tests**: 22
- **Passing**: 22 ✅
- **Failing**: 0
- **Coverage**: 77%

**Test Files**:
- `backend/app/tests/unit/test_infrastructure.py` - 7 tests (infrastructure smoke tests)
- `backend/app/tests/unit/test_security.py` - 15 tests (security utilities)

---

## Questions?

If tests still don't show up after reloading:
1. Check VS Code Output panel for errors
2. Verify Python interpreter is set correctly
3. Make sure pytest is installed in the Poetry environment
4. Try running tests in terminal first to verify they work
