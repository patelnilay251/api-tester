# API Flow Tester

A modern, visual API testing tool built with Next.js and React Flow. Create interactive node-based workflows to test and visualize API requests and responses.

## ✨ Features

### 🎨 **Visual Interface**
- **Node-based workflow** - Drag and drop API request nodes
- **Real-time connections** - Visual flow from requests to responses
- **Clean grid canvas** - Fine 10px grid for precise alignment
- **Responsive design** - Works on all screen sizes

### 🌙 **Theme Support**
- **Dark/Light mode** - Toggle with sun/moon button
- **Automatic detection** - Respects system preferences
- **Theme persistence** - Remembers your choice
- **Smooth transitions** - All elements adapt seamlessly

### 🔗 **API Testing**
- **Multiple HTTP methods** - GET, POST, PUT, DELETE, PATCH
- **Custom headers** - JSON or key-value format support
- **Request body** - For POST/PUT/PATCH operations
- **Response visualization** - Status codes, headers, and data
- **Response time tracking** - Performance metrics

### 🎛️ **Node Management**
- **Expandable forms** - Compact and detailed views
- **Editable names** - Rename nodes for organization
- **Delete operations** - Remove single nodes or entire chains
- **Auto-positioning** - Smart placement of response nodes

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd api-tester

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Test Server (Optional)

A companion test server is included for testing:

```bash
cd test-api-server
npm install
npm start
```

The test server runs on port 3001 and provides sample endpoints for testing.

## 🎯 Usage

1. **Create API Request**
   - Click "Add API Node" to create a new request
   - Enter the URL and select HTTP method
   - Add headers and request body if needed

2. **Send Request**
   - Click "Send Request" to execute
   - Response node appears automatically
   - View status, headers, and response data

3. **Manage Workflow**
   - Drag nodes to reorganize
   - Rename nodes for better organization
   - Delete individual nodes or entire chains
   - Toggle between light/dark themes

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Framework**: TailwindCSS 4
- **Flow Editor**: React Flow (@xyflow/react)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Test Server**: Express.js

## 🤖 LLM (Agent) Setup

This app includes a streaming Agent API backed by Google Gemini via the Vercel AI SDK.

1) Install deps (already in package.json):

```
npm install
```

2) Configure environment:

Create `.env.local` and set your key (or use Vercel project envs):

```
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

3) Start the dev server and open the chat bar (⌘/Ctrl + I). Select a model (Gemini 2.5 Flash/Pro) and type a prompt to stream a response.

Files:
- `src/app/api/agent/route.ts` — streaming endpoint using `ai` + `@ai-sdk/google`.
- `src/app/page.tsx` — chat bar wired to `/api/agent` streaming.

## 📁 Project Structure

```
api-tester/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   │   ├── ApiRequestNode.tsx
│   │   └── ResponseNode.tsx
│   └── contexts/           # React contexts
│       └── ThemeContext.tsx
├── test-api-server/        # Express test server
└── public/                 # Static assets
```

## 🎨 Design Features

- **Glassmorphism effects** with backdrop blur
- **Custom CSS variables** for consistent theming
- **Grid-based canvas** for visual alignment
- **Smooth animations** and transitions
- **Professional color schemes** for both themes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Built with ❤️ using Next.js and React Flow and Cursor
