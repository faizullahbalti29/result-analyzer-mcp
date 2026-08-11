# MCP Project

This project provides an MCP (Model Context Protocol) server for working with student result data.

## Features

- Query student information from the local database
- Validate result data against expected formats
- Analyze student results and filter by criteria

## Project Structure

- src/ - Source code for the MCP server and tools
- src/tools/ - Tool implementations for querying and validating results
- src/types/ - Type definitions for student and result data
- src/utils/ - Helper utilities

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run the server:
   ```bash
   npm start
   ```

## Development

The project uses TypeScript and Node.js. You can inspect the package scripts in package.json for available commands.

## Notes

- Ensure the database file is available and configured correctly before running queries.
- The MCP server manifest and bundle files are included in the project root.
