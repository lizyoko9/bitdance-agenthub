# AgentHub Modular Core Design

Date: 2026-07-05
Status: Draft for user review

## Purpose

AgentHub should stop growing as a pile of disconnected screens. The product will be rebuilt around three modules in this order:

1. Software Capability Store
2. Agent Orchestration Canvas
3. AI Employee Workbench

The priority order is intentional. Agents cannot run reliably until software capabilities are connected and testable. Workflows cannot be useful until they can call those capabilities. The workbench should become the simple user entry point only after the underlying capability and orchestration layers are stable.

## Confirmed Product Direction

The selected approach is a modular rebuild of the core experience.

Rejected approaches:

- Patch the existing pages in place. This looks fast, but it keeps the current coupling and makes each fix likely to create new UI or runtime bugs.
- Make the canvas the whole product, Langflow or ComfyUI style. This is powerful for advanced users, but too complex as the first screen for most Chinese desktop users.

Recommended and approved approach:

- Build a clean capability store first.
- Let the canvas compose agents, tools, software commands, approvals, conditions, and artifacts.
- Let the workbench provide a simple "tell the AI employee what to do" entry point.

## Core Principles

- Configuration belongs in configuration surfaces.
- Orchestration belongs on the canvas.
- Execution belongs in the runtime.
- Results belong in artifacts.
- AgentHub itself is free: no paid tiers, no membership gating, no paywalled modules, and no upsell UI.
- External model/API/CLI costs can be shown as usage reminders, but they are not AgentHub product pricing.
- Ordinary users should see simple decisions first.
- Advanced CLI, MCP, API, and automation parameters should stay available but collapsed by default.
- A feature should be added as a module with a clear contract, not as another block inside an already crowded page.

## Main Navigation

The first version should keep the main navigation small:

- Workbench
- Conversations
- Agents
- Software Capabilities
- Orchestration Canvas
- Workflows
- Artifacts
- Model Management
- Analytics

These should not be top-level pages in the first version:

- Runtime scene
- Automatic tasks
- Config management
- Security governance
- Context
- Capability graph
- Team collaboration

Their useful pieces should move into agent settings, project settings, or advanced sections.

## Module 1: Software Capability Store

### Role

The Software Capability Store answers one question:

What can an Agent use on this computer?

It manages connection, testing, and assignment of local and external capabilities. It does not decide how an Agent thinks, and it does not run workflows.

### Home Page

The home page should feel like a software store, not like an admin control panel.

Each software or service appears as a card:

- Codex CLI
- Claude Code
- OpenCode
- GitHub
- Chrome
- WeChat
- Feishu
- Notion
- Jianying / CapCut
- SkillsMap

Cards show:

- Software name
- Category
- Connection status
- Available modes
- Default mode
- Last test result

Clicking a card opens a detail page or modal for that software.

### Software Detail Page

Each software detail page has two layers.

Simple mode is shown by default:

- Connection status
- Detect button
- Test run button
- Enable or disable
- Assign to Agent
- Default invocation mode
- Last output or error

Advanced configuration is collapsed by default:

- CLI path
- Args template
- Working directory
- Environment variables
- MCP command or endpoint
- API base URL and key reference
- Browser automation profile
- Desktop automation profile
- Permission level
- Fallback invocation mode

### Invocation Modes

A software can support one or more modes:

- CLI
- MCP
- API
- Browser automation
- Desktop automation
- Recorded macro

The user chooses the default mode per software. For example:

- Codex CLI defaults to CLI.
- GitHub can default to API or MCP.
- Chrome defaults to browser automation.
- Jianying can default to software command or recorded macro.

If the default mode is unavailable, the runtime may try a configured fallback mode.

### First-Version Capability Depth

First version target:

- Capability can be configured.
- Capability can be detected.
- Capability can be test-run.
- Capability can be assigned to one or more Agents.
- Test output is visible to the user.

The first version does not need every software to be deeply automated. It must make the connection model stable.

## Module 2: Agent Orchestration Canvas

### Role

The canvas answers one question:

How do Agents, tools, software commands, approvals, conditions, and artifacts work together?

It should not expose raw CLI or MCP configuration. It should only select capabilities already connected in the Software Capability Store.

### Node Types

First-class nodes in version one:

- Agent node
- Tool node
- Software command node
- Artifact node

Advanced nodes are available under a "more nodes" area:

- Human approval
- Condition
- Merge
- Parallel

### Agent Node

An Agent node shows business-level configuration:

- What this Agent does
- Which Agent profile it uses
- Required input
- Required output
- Whether approval is required
- Whether output is customer-visible

It does not show every low-level model, prompt, CLI, MCP, permission, or memory setting directly on the canvas. Those details live in Agent settings.

### Edge Semantics

Each edge means two things:

1. Execution order
2. Artifact flow

Edges must carry an artifact type.

Supported artifact types:

- Video
- Image
- Code
- Document
- Spreadsheet
- JSON
- File bundle
- Report
- Browser state
- Desktop result

If an upstream node produces video, code, and a document, a downstream node should only receive the artifact type selected by the edge.

### Edge Interaction

The canvas supports both expert and ordinary workflows:

- Expert users can drag from a specific output port, such as "video" or "code".
- Ordinary users can click an existing edge and change the artifact type from the inspector.

The downstream node only sees the artifact type carried by that edge.

### Node Artifact Display

Each node should show a compact summary:

- Status
- Progress
- Expected outputs
- Produced outputs
- Customer-visible outputs

Details open in the right inspector.

### Right Inspector

When a node is selected, the inspector shows:

- Node name
- Node type
- Selected Agent, tool, or software command
- Input artifact types
- Output artifact types
- Node goal
- Acceptance criteria
- Permission requirements
- Runtime logs
- Artifact list

When an edge is selected, the inspector shows:

- Artifact type carried by the edge
- Source node
- Target node
- Whether it is customer-visible
- Whether the target must wait for source completion

## Module 3: AI Employee Workbench

### Role

The workbench answers one question:

How does a normal user start and follow work?

It should be the simple entry point. It should not look like a configuration center.

### Task Entry

The default entry is one natural-language task box.

Example tasks:

- Help me find why this project cannot run.
- Turn these clips into a short video.
- Organize customer messages from WeChat.
- Write a product proposal and generate a document.

Advanced users may also choose:

- A specific Agent
- A specific workflow
- A specific model
- A specific software capability
- A required artifact type

### Workbench Layout

The workbench has three areas:

1. Task input
2. Task execution progress
3. Final artifacts

Progress should use human-readable stages:

- Understanding goal
- Choosing Agent
- Checking tools
- Running workflow node
- Waiting for approval
- Generating artifact
- Completed
- Failed

Logs, command output, and low-level tool calls are collapsed by default.

### Workbench and Canvas Relationship

The workbench calls the canvas and runtime; it does not replace them.

If a matching workflow exists:

- The workbench starts that workflow.
- The canvas represents the underlying execution structure.
- Node status updates are visible.
- Final artifacts return to the workbench.

If no matching workflow exists:

- The system can run a simple one-Agent task.
- It selects an Agent and assigned capabilities.
- It produces an artifact directly.

## Agent Settings

Agent settings answer:

What is this employee allowed and expected to do?

Each Agent can configure:

- Name
- Role
- Default model
- Assigned software capabilities
- Skills
- Memory policy
- Permission policy
- Project-level trust state
- Required output contract

Agent settings should absorb several previously separate concepts:

- Context
- Memory
- Capability graph
- Collaboration
- Security defaults

These concepts can exist as sections inside Agent settings instead of top-level navigation pages.

## Permissions and Trust

### Default Policy

Low-risk actions can run automatically.

Examples:

- Read workspace files
- Detect whether a CLI exists
- Open a webpage
- Query local software status
- Generate temporary files

High-risk actions require confirmation.

Examples:

- Delete files
- Send WeChat or Feishu messages
- Modify system settings
- Install dependencies
- Execute unknown commands
- Operate the physical desktop
- Publish content
- Submit data externally

### Project-Level Trust

The user can mark an Agent as trusted inside a project.

When trusted:

- That Agent can automatically execute more high-risk actions inside that project.
- The trust does not apply to other projects.
- The trust can be revoked.

This avoids asking for confirmation too often without granting dangerous global permissions.

## Core Data Model

The first version should center on these entities.

### SoftwareApp

Represents an app or service, such as WeChat, Chrome, Jianying, Codex CLI, or GitHub.

Important fields:

- id
- name
- category
- description
- icon
- status
- defaultCapabilityId

### SoftwareCapability

Represents one way to call a software app.

Important fields:

- id
- softwareAppId
- mode: CLI, MCP, API, browser automation, desktop automation, macro
- displayName
- enabled
- healthStatus
- fallbackCapabilityIds

### CapabilityCommand

Represents one callable command.

Important fields:

- id
- capabilityId
- name
- description
- inputSchema
- outputSchema
- riskLevel
- requiresApproval
- implementation

### AgentProfile

Represents an AI employee.

Important fields:

- id
- name
- role
- modelProfileId
- assignedCapabilityIds
- skillIds
- memoryPolicy
- permissionPolicy
- outputContract

### AgentCapabilityAssignment

Represents which capabilities an Agent can use.

Important fields:

- id
- agentId
- capabilityId
- projectId
- enabled
- defaultForAgent

### Workflow

Represents an orchestration flow.

Important fields:

- id
- name
- description
- version
- status

### WorkflowNode

Represents a canvas node.

Important fields:

- id
- workflowId
- type
- agentProfileId
- capabilityCommandId
- inputContract
- outputContract
- position

### WorkflowEdge

Represents both execution order and artifact flow.

Important fields:

- id
- workflowId
- sourceNodeId
- sourcePortId
- targetNodeId
- targetPortId
- artifactType
- required

### WorkflowRun

Represents one workflow execution.

Important fields:

- id
- workflowId
- projectId
- status
- startedAt
- completedAt

### NodeRun

Represents one node execution.

Important fields:

- id
- workflowRunId
- workflowNodeId
- status
- progress
- logs
- error

### Artifact

Represents produced output.

Important fields:

- id
- workflowRunId
- nodeRunId
- artifactType
- title
- path
- metadata
- customerVisible

### PermissionGrant

Represents approvals and project-level trust.

Important fields:

- id
- projectId
- agentId
- scope
- grantedBy
- expiresAt

## Runtime Responsibilities

The runtime executes work. It should:

- Create workflow runs.
- Execute nodes in dependency order.
- Pass only the artifact type declared on each edge.
- Call Agent profiles.
- Call assigned software capabilities.
- Enforce permission policy.
- Request approval when needed.
- Write logs.
- Save artifacts.
- Mark failures clearly.

The runtime should not own UI layout or software configuration forms.

## First Implementation Scope

### Phase 1: Software Capability Store

Build:

- Software cards
- Software detail page
- Simple mode
- Advanced mode
- Capability detection
- Test run
- Assign to Agent
- Default invocation mode

Do not build:

- Deep automation for every app
- Phone control
- Virtual workstation

### Phase 2: Agent Capability Assignment

Build:

- Agent settings section for assigned capabilities
- Permission policy
- Project-level trust indicator

Do not build:

- Full learning system
- Separate capability graph page

### Phase 3: Orchestration Canvas

Build:

- Agent nodes
- Tool nodes
- Software command nodes
- Artifact nodes
- Artifact output ports
- Edge artifact type
- Node inspector
- Edge inspector

Do not build:

- Full Langflow clone
- Huge node marketplace
- Complex nested workflows

### Phase 4: Workbench

Build:

- One-sentence task input
- Optional Agent selection
- Optional workflow selection
- Task progress timeline
- Final artifact area

Do not build:

- Full automatic workflow synthesis
- Autonomous long-running employee OS

## Acceptance Criteria

The design is successful when:

- A user can open Software Capabilities and understand it as an app-like store.
- A user can select a software app and see simple actions first.
- Advanced CLI, MCP, API, and automation settings are still reachable.
- A user can detect and test-run at least one capability.
- A user can assign a capability to an Agent.
- An Agent node on the canvas can choose an assigned capability without editing raw CLI or MCP config.
- A workflow edge clearly carries one artifact type.
- A downstream node receives only the artifact type selected on the edge.
- The workbench can start a task by natural-language input and show progress plus final artifacts.
- Main navigation is not crowded with internal configuration pages.

## Risks and Controls

Risk: Rebuilding too much at once.

Control: Implement in the C to B to A order and stop each phase at a verified usable milestone.

Risk: Advanced users need CLI and MCP control.

Control: Keep advanced configuration available but collapsed.

Risk: Ordinary users feel overwhelmed.

Control: Use app-like cards, simple actions, and business-language labels.

Risk: Agents get dangerous permissions.

Control: Use low-risk automatic execution by default and project-level trust for expanded automation.

Risk: Canvas becomes another complicated technical page.

Control: Keep common node types visible and move advanced nodes into a secondary area.

## Implementation Rule

No new feature work should continue until it can be mapped to one of these modules:

- Software Capability Store
- Agent Settings
- Orchestration Canvas
- Runtime
- Artifacts
- Workbench
- Model Management
- Analytics

If a feature does not fit one of those modules, it should be postponed or redesigned.
