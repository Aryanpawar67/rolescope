# Skills Mapper — Test Cases

Human-verifiable test cases for the Skills Mapper page.
Each case covers a distinct domain so emerging/diminishing outputs can be cross-checked against real industry knowledge.

Paste the **Job Description** into the *Job Description / Purpose* field and the **Tasks** block into the *Tasks* field (one per line). Fill Organisation, Industry, and Department as listed.

---

## TC-01 — Backend Software Engineer (Fintech)


| Field        | Value                        |
| ------------ | ---------------------------- |
| Organisation | Zeta Financial Technologies  |
| Industry     | Fintech / Banking Technology |
| Department   | Platform Engineering         |


**Job Description:**

```
We are looking for a Backend Software Engineer to design, build, and maintain high-throughput APIs and microservices that power our core payment processing platform. You will work within a distributed systems environment handling millions of transactions daily.

You are expected to write production-grade code in Java and Python, own services end-to-end from design through deployment, and participate in on-call rotations. You will collaborate closely with product, mobile, and data engineering teams.

The role requires strong fundamentals in relational databases (PostgreSQL), message queuing (Kafka), and containerised deployments on AWS. Experience with gRPC, REST API design, and observability tooling (Datadog, OpenTelemetry) is expected. You will be responsible for writing technical design documents and conducting code reviews for junior engineers.

We are progressively adopting AI-assisted development tooling and expect engineers to evaluate and integrate these effectively into daily workflows.
```

**Tasks:**

```
Design and implement RESTful and gRPC APIs for payment processing services
Write and maintain unit, integration, and contract tests for backend services
Conduct code reviews and provide technical mentoring to junior engineers
Own service reliability through on-call participation and incident response
Design Kafka-based event streaming pipelines for transaction data
Write technical design documents for new features and architectural changes
Instrument services with OpenTelemetry for distributed tracing and alerting
Collaborate with data engineering to define schemas and data contracts
Evaluate and integrate AI-assisted coding tools into team workflows
Optimise PostgreSQL query performance and manage schema migrations
```

**What to verify in output:**

- Emerging should surface: AI-augmented development, platform engineering patterns (OpenTelemetry, eBPF), async event-driven architecture, LLM tool integration
- Diminishing should surface: hand-rolled REST boilerplate, manual SQL migration scripting, monolithic service patterns

---

## TC-02 — Frontend / UI Engineer (SaaS Product)


| Field        | Value                        |
| ------------ | ---------------------------- |
| Organisation | Notion Labs                  |
| Industry     | SaaS / Productivity Software |
| Department   | Product Engineering          |


**Job Description:**

```
As a Frontend Engineer on our product team, you will build fast, accessible, and delightful user interfaces for our web application used by over 30 million people. You will work in a React + TypeScript codebase and own entire feature surfaces from design handoff through production shipping.

You will partner closely with designers using Figma, implement component libraries using our internal design system, and write end-to-end tests using Playwright. Performance budgets and Core Web Vitals are first-class concerns — you are expected to profile and optimise rendering bottlenecks.

We are increasingly using AI-powered features in the product itself (smart suggestions, summarisation, AI writing assistant) and engineers are expected to understand how to build interfaces that wrap LLM APIs effectively, handle streaming responses, and manage latency-sensitive UX patterns.

Experience with state management (Zustand, Jotai), server components (Next.js App Router), and accessibility standards (WCAG 2.2) is expected.
```

**Tasks:**

```
Implement new product features in React and TypeScript from Figma designs
Build and maintain reusable components in the internal design system
Write end-to-end tests using Playwright for critical user flows
Profile and optimise rendering performance using Chrome DevTools and web vitals
Integrate LLM API calls and handle streaming text responses in the UI
Implement accessible UI components meeting WCAG 2.2 standards
Conduct design reviews and provide feedback on component specifications
Manage client-side state using Zustand or Jotai across complex feature surfaces
Ship features using Next.js App Router with server and client component boundaries
Participate in frontend architecture decisions and technical roadmap planning
```

**What to verify in output:**

- Emerging should surface: AI/LLM UI patterns (streaming UX, latency handling), React Server Components, edge rendering, accessibility-as-standard
- Diminishing should surface: class-based React components, Redux for simple state, manual CSS without design systems, jQuery-era patterns

---

## TC-03 — Data Engineer (E-commerce / Retail)


| Field        | Value               |
| ------------ | ------------------- |
| Organisation | Myntra              |
| Industry     | E-commerce / Retail |
| Department   | Data Platform       |


**Job Description:**

```
We are hiring a Data Engineer to build and maintain our centralised data platform that supports analytics, machine learning, and business intelligence across the organisation. You will design and operate ELT pipelines using dbt and Apache Spark, manage our data warehouse on Snowflake, and ensure data quality through automated testing and observability.

You will work closely with analytics engineers, ML engineers, and business stakeholders to model data that is accurate, performant, and self-serve friendly. You are expected to implement data contracts, maintain lineage documentation, and contribute to our migration from a legacy Hadoop cluster to a fully cloud-native architecture.

The role requires hands-on experience with Airflow for orchestration, strong SQL skills, and familiarity with the modern data stack (dbt, Fivetran, Snowflake). You will also be expected to evaluate AI-assisted data transformation tools and contribute to our internal data mesh governance model.
```

**Tasks:**

```
Design and implement ELT pipelines using dbt and Apache Spark
Manage and optimise Snowflake data warehouse including cost governance
Build Airflow DAGs for pipeline orchestration and scheduling
Implement data quality checks and automated testing using Great Expectations or dbt tests
Define and enforce data contracts between upstream producers and downstream consumers
Model analytical data layers (staging, intermediate, mart) using dbt best practices
Collaborate with ML engineers to prepare feature datasets and training pipelines
Migrate legacy Hadoop-based pipelines to cloud-native Spark on AWS EMR
Maintain data lineage documentation and metadata in the data catalogue
Evaluate AI-assisted SQL generation and data transformation tools
```

**What to verify in output:**

- Emerging should surface: data mesh architecture, data contracts, AI-assisted SQL/transformation, streaming analytics, LLM-based data cataloguing
- Diminishing should surface: legacy Hadoop/HDFS skills, hand-rolled ETL scripting, unmanaged data warehouse without dbt, undocumented pipeline code

---

## TC-04 — Product Marketing Manager (B2B SaaS)


| Field        | Value             |
| ------------ | ----------------- |
| Organisation | Freshworks        |
| Industry     | B2B SaaS / CRM    |
| Department   | Product Marketing |


**Job Description:**

```
We are looking for a Product Marketing Manager to own the go-to-market strategy for our CRM and customer support product lines. You will develop positioning, messaging, and competitive intelligence that enables our sales team and shapes product direction.

You will work cross-functionally with product management, sales, and demand generation to launch new features, create sales enablement materials, and build category narratives. You are expected to conduct win/loss analysis, run customer interviews, and translate technical product capabilities into compelling value propositions for enterprise buyers.

The role requires strong writing skills, comfort with data analysis (usage metrics, funnel data, competitive benchmarks), and experience running product launches. You will be expected to leverage AI writing tools to scale content production while maintaining brand voice, and use AI-powered competitive intelligence platforms to track market signals at speed.

Experience with tools like Salesforce, Gong, Highspot, and Chorus is preferred.
```

**Tasks:**

```
Develop positioning and messaging frameworks for core product lines
Write and maintain sales enablement collateral including battlecards, one-pagers, and pitch decks
Conduct win/loss interviews with customers and analyse deal outcome data
Build and deliver competitive intelligence reports to sales and leadership
Plan and execute product launch campaigns in collaboration with demand generation
Run customer advisory board sessions and synthesise product feedback
Translate technical product capabilities into enterprise buyer value propositions
Analyse product usage data and funnel metrics to identify messaging gaps
Use AI tools to scale content production across sales and marketing channels
Collaborate with product management on roadmap prioritisation using market evidence
```

**What to verify in output:**

- Emerging should surface: AI-powered competitive intelligence, pipeline marketing metrics, narrative-led category creation, product-led growth marketing, AI content scaling
- Diminishing should surface: static PDF battlecards, manually produced datasheets, spray-and-pray email campaigns, intuition-driven messaging without data

---

## TC-05 — Brand Strategist (Consumer Goods)


| Field        | Value                     |
| ------------ | ------------------------- |
| Organisation | Mamaearth                 |
| Industry     | FMCG / Direct-to-Consumer |
| Department   | Brand Strategy            |


**Job Description:**

```
We are hiring a Brand Strategist to define and evolve the long-term brand identity for Mamaearth and its sub-brands. You will be responsible for brand architecture decisions, tone of voice guidelines, visual identity consistency, and consumer research that informs how the brand shows up across every touchpoint.

You will partner with creative, digital, and retail teams to ensure brand coherence from packaging to performance advertising. You will commission and analyse brand health tracking studies, NPS surveys, and qualitative research to measure brand equity and inform strategic pivots.

The role demands strong consumer insight skills, the ability to translate cultural and social trends into brand strategy, and experience building brand playbooks used by cross-functional teams. You are expected to understand how AI-generated creative assets affect brand consistency and develop governance frameworks for AI use within brand guidelines.

Experience with brand measurement platforms (YouGov BrandIndex, Kantar) and social listening tools is expected.
```

**Tasks:**

```
Define and maintain brand architecture across master brand and sub-brands
Write and govern brand guidelines including tone of voice, visual identity, and messaging hierarchy
Commission and interpret brand health tracking studies and NPS surveys
Conduct qualitative consumer research including focus groups and ethnographic studies
Identify cultural and social trends relevant to brand positioning and flag strategic opportunities
Build brand playbooks for use by creative, digital, and retail execution teams
Develop governance frameworks for AI-generated creative to maintain brand consistency
Partner with packaging and retail teams to ensure brand expression at point of sale
Evaluate brand equity impacts of major campaigns and product launches
Present brand strategy and performance to senior leadership and external agency partners
```

**What to verify in output:**

- Emerging should surface: AI creative governance, cultural intelligence frameworks, community-led brand building, social commerce brand expression, brand safety in generative AI
- Diminishing should surface: static brand manuals rarely updated, agency-dependent brand research, TV-first campaign thinking, brand health measured only annually

---

## TC-06 — Growth / Performance Marketing Manager (Consumer Tech)


| Field        | Value                          |
| ------------ | ------------------------------ |
| Organisation | Zepto                          |
| Industry     | Quick Commerce / Consumer Tech |
| Department   | Growth Marketing               |


**Job Description:**

```
We are looking for a Growth Marketing Manager to own paid user acquisition and retention marketing across digital channels including Meta, Google, YouTube, and programmatic. You will manage significant monthly ad budgets, optimise CAC and LTV metrics, and collaborate with creative, product, and data teams to drive sustainable growth.

You will design and run A/B and multivariate experiments across creatives, landing pages, and audience segments. You are expected to be deeply analytical, comfortable writing SQL queries for cohort analysis, and capable of building dashboards in Looker or Tableau.

The role requires hands-on experience with campaign management platforms, mobile measurement partners (Appsflyer, Adjust), and an understanding of iOS privacy changes and their impact on attribution. You will be expected to leverage AI tools for ad creative generation and testing, and stay current with automated bidding strategies and Performance Max campaign structures.

Experience with lifecycle marketing tools (Clevertap, Braze) for push, email, and in-app campaigns is also required.
```

**Tasks:**

```
Manage and optimise paid acquisition campaigns across Meta, Google, YouTube, and programmatic channels
Design and execute A/B and multivariate experiments on creatives, audiences, and landing pages
Build and maintain performance dashboards in Looker tracking CAC, LTV, ROAS, and retention cohorts
Write SQL queries for cohort analysis and custom attribution reporting
Manage mobile measurement partner integrations and debug attribution discrepancies
Develop lifecycle marketing campaigns in Clevertap across push, email, and in-app channels
Leverage AI tools for ad creative generation, copy testing, and audience signal modelling
Collaborate with creative team on performance creative briefs and iteration cycles
Forecast budget requirements and model growth scenarios for weekly and quarterly planning
Monitor iOS and Android privacy policy changes and adapt attribution strategy accordingly
```

**What to verify in output:**

- Emerging should surface: AI creative generation and testing, privacy-first attribution (MMM, incrementality), Performance Max automation, first-party data strategy, predictive LTV modelling
- Diminishing should surface: last-click attribution, manual keyword bidding, static creative without systematic testing, cookie-based retargeting

---

## TC-07 — DevOps / Platform Engineer (Cloud-Native)


| Field        | Value                     |
| ------------ | ------------------------- |
| Organisation | Razorpay                  |
| Industry     | Fintech / Payments        |
| Department   | Infrastructure & Platform |


**Job Description:**

```
We are hiring a Platform Engineer to build and maintain the internal developer platform that enables 300+ engineers to ship software reliably and at speed. You will own our Kubernetes-based infrastructure on AWS, manage CI/CD pipelines using GitHub Actions and ArgoCD, and build self-service tooling that reduces cognitive load for product engineering teams.

You will be responsible for infrastructure-as-code using Terraform, service mesh configuration (Istio), and the observability stack (Prometheus, Grafana, Loki, Tempo). You are expected to drive the adoption of platform engineering principles — golden paths, paved roads, and internal developer portals (Backstage) — reducing toil across the engineering organisation.

The role requires strong operational experience, excellent debugging skills for distributed systems failures, and the ability to influence engineering culture around reliability. You are expected to evaluate AI-assisted infrastructure tooling (AI-powered anomaly detection, Copilot for IaC) and incorporate them where they demonstrably reduce toil.
```

**Tasks:**

```
Design and operate Kubernetes clusters on AWS EKS across multiple environments
Build and maintain CI/CD pipelines using GitHub Actions and ArgoCD for GitOps deployments
Write and manage infrastructure as code using Terraform and Helm
Configure and operate the service mesh (Istio) for traffic management and mTLS
Build and maintain the observability stack using Prometheus, Grafana, Loki, and Tempo
Develop internal developer portal capabilities using Backstage to create golden path templates
Respond to infrastructure incidents, conduct root cause analysis, and drive reliability improvements
Evaluate and integrate AI-assisted tooling for anomaly detection and IaC code generation
Define and enforce platform SLOs and error budgets with product engineering teams
Conduct capacity planning and cost optimisation reviews for cloud infrastructure spend
```

**What to verify in output:**

- Emerging should surface: platform engineering (internal developer platforms, golden paths), eBPF-based observability, AI-assisted IaC, GitOps maturity, FinOps
- Diminishing should surface: manual server provisioning, Jenkins-based pipelines, Nagios-era monitoring, hand-managed Kubernetes YAML without GitOps

---

## TC-08 — Content Marketing Lead (B2B Tech / HR Tech)


| Field        | Value                               |
| ------------ | ----------------------------------- |
| Organisation | iMocha                              |
| Industry     | HR Technology / Talent Intelligence |
| Department   | Marketing                           |


**Job Description:**

```
We are looking for a Content Marketing Lead to build and execute a content strategy that drives organic growth, thought leadership, and pipeline for iMocha's skills intelligence platform. You will own the editorial calendar, manage a team of writers and freelancers, and produce high-quality long-form content including research reports, white papers, case studies, and blog posts targeting CHROs, L&D leaders, and talent acquisition professionals.

You will collaborate with the SEO team to ensure content is optimised for both traditional search and AI answer engines (ChatGPT, Perplexity, Google AI Overviews). You are expected to use AI writing tools to accelerate production without compromising depth or authority, and to build content distribution playbooks that extend reach through LinkedIn, newsletters, and content syndication.

You will be responsible for measuring content impact through organic traffic, MQL attribution, and engagement metrics, using tools like HubSpot, SEMrush, and GA4. Experience with sales enablement content and ability to write for senior HR and business audiences is essential.
```

**Tasks:**

```
Develop and own the content strategy and editorial calendar aligned to pipeline goals
Write and edit long-form content including research reports, white papers, and case studies
Manage a team of in-house writers and external freelancers with editorial oversight
Optimise content for SEO and AI answer engine visibility (AEO) using SEMrush and Clearscope
Use AI writing tools to accelerate content production while maintaining editorial quality
Build content distribution playbooks for LinkedIn, email newsletters, and syndication partners
Measure content performance using GA4, HubSpot attribution, and SEMrush rank tracking
Collaborate with sales to develop enablement content including one-pagers and pitch narratives
Commission and analyse original research for thought leadership reports
Brief and review creative assets (infographics, social cards) produced by the design team
```

**What to verify in output:**

- Emerging should surface: AEO/answer engine optimisation, AI-assisted content production, content-led pipeline attribution, research-led thought leadership, LinkedIn-native content formats
- Diminishing should surface: keyword-stuffed SEO articles, gated PDF whitepapers as primary lead gen, spray email newsletters without segmentation, agency-dependent content production

---

## How to Use These Test Cases

1. Open **Skills Mapper** → **Run Analysis** tab
2. Fill in the four context fields (Organisation, Industry, Department)
3. Paste the Job Description text into **Job Description / Purpose**
4. Paste the Tasks (without the surrounding code block markers) into **Tasks**
5. Select your models (default: GPT-4o, GPT-5.3, OSS 120B)
6. Click **Run Emerging + Diminishing**
7. Once results appear, click **Evaluate with Claude** to get the evaluator's verdict
8. Cross-check the output against the **"What to verify"** notes at the bottom of each test case

### Evaluation Checklist per Test Case

- Are emerging skills specific to the role/industry, or generic market noise?
- Do diminishing skills have a clear, believable decline driver (AI automation, tool supersession, etc.)?
- Does Claude's evaluator correctly identify which model had the most grounded output?
- Are consensus skills (2+ models agree) the ones that feel most obviously correct to a human?
- Are flagged issues real problems or false positives?

