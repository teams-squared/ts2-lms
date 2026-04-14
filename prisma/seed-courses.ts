import { PrismaClient, CourseStatus, LessonType } from "@prisma/client";

type LessonDef = {
  title: string;
  type: LessonType;
  content: string | null;
  quizQuestions?: {
    text: string;
    options: { text: string; isCorrect: boolean }[];
  }[];
};

type ModuleDef = {
  title: string;
  lessons: LessonDef[];
};

type CourseDef = {
  title: string;
  description: string;
  category: string;
  requiredClearance: string | null;
  prerequisiteTitles: string[];
  modules: ModuleDef[];
};

export const COURSE_PACKAGES: CourseDef[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. CYBERSECURITY ONBOARDING
  // ─────────────────────────────────────────────────────────────────────────
  {
    title: "Cybersecurity Onboarding",
    description:
      "Essential security awareness training for all new team members. Covers password hygiene, phishing recognition, device security, and incident response basics.",
    category: "onboarding",
    requiredClearance: null,
    prerequisiteTitles: [],
    modules: [
      {
        title: "Security Awareness Fundamentals",
        lessons: [
          {
            title: "Why Cybersecurity Matters",
            type: LessonType.TEXT,
            content: `# Why Cybersecurity Matters

Cybersecurity is everyone's responsibility — not just the IT department's. Every team member has access to systems, data, and communications that attackers value.

## The Cost of Breaches

- The average data breach costs **$4.45 million** (IBM Security, 2023)
- **95% of breaches** involve human error at some point
- Recovery takes an average of **277 days**

## What You're Protecting

As an employee you have access to:
- **Customer data** — personal information, contracts, payment details
- **Internal systems** — HR platforms, financial tools, code repositories
- **Communications** — email, Slack, confidential documents

Every time you click a link, use a password, or connect to Wi-Fi, you are making a security decision.

## Your Role

You don't need to be a security expert. You need to:
1. Know the most common attack vectors
2. Recognise warning signs
3. Know who to contact when something looks wrong
4. Follow company policies consistently

This course will give you the foundation to do all four.`,
          },
          {
            title: "The CIA Triad",
            type: LessonType.TEXT,
            content: `# The CIA Triad

All of information security is built on three core principles: **Confidentiality**, **Integrity**, and **Availability**.

## Confidentiality

Information should only be accessible to people who are authorised to see it.

**Examples:**
- Encrypting sensitive documents before emailing them
- Not leaving your screen unlocked in a shared space
- Using role-based access controls so employees only see what they need

## Integrity

Data should be accurate and unmodified by unauthorised parties.

**Examples:**
- Verifying software downloads against published checksums
- Using version control for code so changes are tracked
- Detecting when a file has been altered unexpectedly

## Availability

Systems and data should be accessible when legitimate users need them.

**Examples:**
- Keeping backups so you can restore after ransomware
- Using redundant infrastructure to survive hardware failures
- Protecting against denial-of-service attacks

## Applying the Triad

When you encounter a security decision, ask yourself:
- **C** — Could this expose information to the wrong people?
- **I** — Could this allow data to be tampered with?
- **A** — Could this make systems unavailable?`,
          },
          {
            title: "Introduction to Threat Landscape",
            type: LessonType.VIDEO,
            content: "https://www.youtube.com/embed/inWWhr5tnEA",
          },
          {
            title: "Security Awareness Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 75 }),
            quizQuestions: [
              {
                text: "What percentage of data breaches involve human error?",
                options: [
                  { text: "25%", isCorrect: false },
                  { text: "55%", isCorrect: false },
                  { text: "95%", isCorrect: true },
                  { text: "100%", isCorrect: false },
                ],
              },
              {
                text: "Which CIA triad principle ensures only authorised users can access data?",
                options: [
                  { text: "Availability", isCorrect: false },
                  { text: "Integrity", isCorrect: false },
                  { text: "Confidentiality", isCorrect: true },
                  { text: "Authentication", isCorrect: false },
                ],
              },
              {
                text: "If you receive a suspicious email at work, what should you do first?",
                options: [
                  { text: "Click the link to see if it is legitimate", isCorrect: false },
                  { text: "Delete it immediately without reporting", isCorrect: false },
                  { text: "Forward it to your personal email to check safely", isCorrect: false },
                  { text: "Report it to IT/Security without clicking anything", isCorrect: true },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Password & Account Security",
        lessons: [
          {
            title: "Password Hygiene Best Practices",
            type: LessonType.TEXT,
            content: `# Password Hygiene Best Practices

Weak or reused passwords are the #1 cause of account takeovers. This lesson covers what makes a good password and how to manage them at scale.

## What Makes a Strong Password?

| Characteristic | Weak | Strong |
|---|---|---|
| Length | 8 characters | 16+ characters |
| Complexity | Dictionary word | Random passphrase |
| Uniqueness | Reused across sites | Unique per account |
| Predictability | Name + birth year | No personal info |

## Passphrases

A passphrase like **"correct-horse-battery-staple"** is:
- Easier to remember than "P@ssw0rd!"
- Significantly stronger due to length
- Hard to guess or brute-force

## Password Managers

The only realistic way to use strong, unique passwords everywhere is a **password manager**. Recommended options:
- **1Password** (company standard)
- Bitwarden
- Dashlane

A password manager stores encrypted passwords locally and syncs across your devices. You only need to remember **one strong master password**.

## Multi-Factor Authentication (MFA)

Always enable MFA where available. Even if your password is stolen, MFA prevents unauthorised access.

**MFA types (strongest to weakest):**
1. Hardware key (YubiKey)
2. Authenticator app (Google Authenticator, Authy)
3. Push notification (Duo, Microsoft Authenticator)
4. SMS code (weakest — avoid if possible)`,
          },
          {
            title: "Recognising Phishing Attacks",
            type: LessonType.TEXT,
            content: `# Recognising Phishing Attacks

Phishing is the most common initial attack vector. Attackers send fraudulent messages to trick you into revealing credentials or installing malware.

## Red Flags in Emails

**Sender address:**
- Domain slightly misspelled (microsofft.com, app1e.com)
- Free email service for a business (gmail.com instead of company.com)
- Name and address don't match

**Content:**
- Urgent or threatening language ("Your account will be suspended in 24 hours")
- Requests for credentials, payment, or sensitive info
- Generic greetings ("Dear Customer") instead of your name
- Grammar and spelling errors

**Links:**
- Hover over links — does the URL match the display text?
- Look for unusual subdomains (login.evil.com/microsoft)
- Shortened URLs that obscure the destination

## Spear Phishing

Targeted attacks use personal information to appear legitimate:
- References your name, role, or manager
- May appear to come from a colleague
- Often arrives at the right time (e.g., during a busy period)

## What To Do

1. **Don't click** — if in doubt, navigate directly to the service
2. **Don't reply** — even to unsubscribe
3. **Report** — forward suspicious emails to security@yourcompany.com
4. **Verify** — call the sender via a known phone number to confirm`,
          },
          {
            title: "Password & Phishing Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "Which of the following is the strongest password strategy?",
                options: [
                  { text: "Use the same complex password everywhere", isCorrect: false },
                  { text: "Use a password manager with unique passwords per site", isCorrect: true },
                  { text: "Write passwords in a notebook kept at your desk", isCorrect: false },
                  { text: "Use your pet's name with numbers at the end", isCorrect: false },
                ],
              },
              {
                text: "An email from 'support@micros0ft.com' asks you to verify your account. What do you do?",
                options: [
                  { text: "Click the link — it looks official", isCorrect: false },
                  { text: "Reply asking for more information", isCorrect: false },
                  { text: "Report it as phishing and do not click", isCorrect: true },
                  { text: "Forward it to your manager", isCorrect: false },
                ],
              },
              {
                text: "What is the primary benefit of Multi-Factor Authentication?",
                options: [
                  { text: "It eliminates the need for passwords", isCorrect: false },
                  { text: "It protects your account even if your password is stolen", isCorrect: true },
                  { text: "It makes passwords easier to remember", isCorrect: false },
                  { text: "It speeds up the login process", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Device & Network Security",
        lessons: [
          {
            title: "Securing Your Devices",
            type: LessonType.TEXT,
            content: `# Securing Your Devices

Your laptop and phone are gateways to company systems. Keeping them secure is a critical part of your security responsibilities.

## Essential Device Settings

**Screen lock:**
- Enable auto-lock after 5 minutes of inactivity
- Use biometric or strong PIN (not pattern or simple PIN)
- Always lock when leaving your device unattended (Windows: Win+L, Mac: Ctrl+Cmd+Q)

**Disk encryption:**
- BitLocker (Windows) or FileVault (Mac) should be enabled by IT
- This protects data if your device is stolen
- Verify it is active in your system settings

**Software updates:**
- Enable automatic updates for OS and applications
- Patches fix vulnerabilities that attackers actively exploit
- Never delay a security update

**Antivirus/EDR:**
- Do not disable endpoint protection software installed by IT
- Report any alerts immediately to the security team

## Safe Browsing

- Use company-approved browsers (Chrome or Firefox)
- Do not install unapproved browser extensions
- Use HTTPS — look for the padlock in the address bar
- Do not download software from unofficial sources

## Physical Security

- Never leave your device unattended in a public place
- Use a privacy screen in public locations
- Report lost or stolen devices immediately — IT can remote-wipe them`,
          },
          {
            title: "Safe Wi-Fi & Remote Work",
            type: LessonType.TEXT,
            content: `# Safe Wi-Fi & Remote Work

Working remotely introduces additional security risks that you need to manage actively.

## Public Wi-Fi Risks

Public Wi-Fi (cafes, airports, hotels) is **untrusted** by default. Risks include:
- **Man-in-the-middle attacks** — attacker intercepts your traffic
- **Evil twin access points** — fake Wi-Fi network mimicking a legitimate one
- **Packet sniffing** — passive capture of unencrypted traffic

## VPN Usage

Always connect to the company VPN when working remotely or on untrusted networks. The VPN:
- Encrypts all traffic between your device and company systems
- Routes traffic through a controlled, monitored gateway
- Protects against man-in-the-middle attacks on public Wi-Fi

**Rule of thumb:** If you wouldn't say it loudly in a coffee shop, don't transmit it over public Wi-Fi without a VPN.

## Home Network Security

- Change your router's default admin password
- Use WPA3 or WPA2 encryption (not WEP or open)
- Keep router firmware updated
- Create a separate guest network for IoT devices and visitors

## Incident Reporting

If you suspect your device or credentials have been compromised:
1. **Disconnect from the network** if you believe malware is active
2. **Contact IT/Security immediately** — do not wait
3. **Do not attempt to fix it yourself** unless directed by IT
4. **Preserve evidence** — don't wipe the device before IT has assessed it`,
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. HR ONBOARDING
  // ─────────────────────────────────────────────────────────────────────────
  {
    title: "HR Onboarding",
    description:
      "Complete HR onboarding covering company policies, code of conduct, benefits, performance management, and workplace culture.",
    category: "onboarding",
    requiredClearance: null,
    prerequisiteTitles: [],
    modules: [
      {
        title: "Company Policies & Code of Conduct",
        lessons: [
          {
            title: "Our Values and Culture",
            type: LessonType.TEXT,
            content: `# Our Values and Culture

Welcome to the team. Understanding our values is the starting point for everything we do here.

## Core Values

### Integrity
We do what we say, say what we mean, and take responsibility for our actions. Integrity means being honest with colleagues, clients, and yourself — especially when it's difficult.

### Collaboration
Our best work happens together. We share knowledge, give credit, and support teammates. Collaboration doesn't mean consensus on everything — it means respecting different perspectives and making decisions together when it matters.

### Continuous Improvement
We are never done growing. We invest in learning, welcome feedback, and are always looking for better ways to do our work. This applies to individuals, teams, and company processes.

### Accountability
We own our commitments. When something doesn't go to plan, we focus on learning and fixing rather than blame.

## What This Means Day-to-Day

- Show up prepared and on time
- Communicate proactively — especially about blockers or delays
- Give feedback directly and respectfully
- Celebrate wins — yours and your teammates'
- Ask for help when you need it

## A Note on Psychological Safety

We aim to create an environment where people can speak up without fear. If you see something that doesn't align with our values, you are encouraged — and expected — to raise it through the appropriate channels.`,
          },
          {
            title: "Code of Conduct",
            type: LessonType.TEXT,
            content: `# Code of Conduct

Our Code of Conduct defines the standards of behaviour expected of every person in the organisation.

## Professional Conduct

All employees are expected to:
- Treat colleagues, clients, and partners with respect
- Maintain confidentiality of sensitive information
- Avoid conflicts of interest and disclose them when they arise
- Use company resources for legitimate business purposes only
- Represent the company professionally in all external interactions

## Anti-Harassment and Discrimination

We are committed to a workplace free from harassment and discrimination. This includes:
- Unwelcome comments about someone's age, gender, race, religion, disability, or sexual orientation
- Intimidation, bullying, or threats
- Inappropriate physical contact
- Sharing offensive content

**These policies apply in all work settings:** the office, remote work, business travel, and company events.

## Reporting Violations

If you experience or witness a Code of Conduct violation:
1. You may report directly to your manager
2. Or report to HR (confidentially)
3. Or use the anonymous ethics hotline

**Retaliation against anyone who makes a good-faith report is a serious violation and grounds for termination.**

## Consequences

Violations of the Code of Conduct may result in:
- Verbal or written warning
- Performance improvement plan
- Suspension
- Termination

The severity depends on the nature and frequency of the behaviour.`,
          },
          {
            title: "Policies Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "Where should you report a Code of Conduct violation if you prefer to remain anonymous?",
                options: [
                  { text: "Your direct manager", isCorrect: false },
                  { text: "The anonymous ethics hotline", isCorrect: true },
                  { text: "A colleague you trust", isCorrect: false },
                  { text: "Social media", isCorrect: false },
                ],
              },
              {
                text: "Which of the following is NOT considered harassment under our policy?",
                options: [
                  { text: "Unwelcome comments about someone's religion", isCorrect: false },
                  { text: "Giving constructive feedback on someone's work", isCorrect: true },
                  { text: "Sharing offensive content in a group chat", isCorrect: false },
                  { text: "Intimidating a colleague", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Benefits & Compensation",
        lessons: [
          {
            title: "Understanding Your Compensation Package",
            type: LessonType.TEXT,
            content: `# Understanding Your Compensation Package

Your compensation package includes more than your base salary. Understanding every component helps you make informed decisions and get the most from your benefits.

## Base Salary

Your base salary is your fixed annual pay, paid bi-weekly. It is reviewed annually during the performance cycle, with adjustments based on your contribution and market data.

## Performance Bonus

Eligible employees receive an annual performance bonus of up to **15%** of base salary, paid in Q1 for the prior year's performance. Bonus amounts are determined by:
- Individual performance rating
- Team/department performance
- Company financial results

## Equity (where applicable)

Senior roles may include stock options or RSUs (Restricted Stock Units) with a **4-year vesting schedule** and a **1-year cliff**.

## Benefits Overview

| Benefit | Details |
|---|---|
| Health insurance | Company pays 80% of premium |
| Dental & vision | Company pays 70% of premium |
| 401(k) | 4% company match, vesting after 1 year |
| Life insurance | 2× annual salary |
| Disability | 60% income replacement |

## Paid Time Off

- **Vacation:** 15 days (Year 1), 20 days (Year 3+)
- **Sick leave:** 10 days per year
- **Holidays:** 11 company holidays
- **Parental leave:** 12 weeks fully paid (primary caregiver), 4 weeks (secondary)`,
          },
          {
            title: "Health & Wellness Benefits",
            type: LessonType.TEXT,
            content: `# Health & Wellness Benefits

We invest in your wellbeing because healthy, supported employees do their best work.

## Medical Insurance

We offer three plan options:
- **PPO Plus** — maximum flexibility, higher premium
- **PPO Standard** — balanced coverage and cost
- **HDHP + HSA** — lower premium, higher deductible, paired with a Health Savings Account

Open enrollment is in November each year. Life events (marriage, birth) allow mid-year changes.

## Mental Health Support

- **Employee Assistance Program (EAP):** 8 free counselling sessions per year
- **Calm / Headspace:** Company-paid subscription
- **Mental health days:** Included in sick leave, no doctor's note required

## Physical Wellness

- **Gym reimbursement:** Up to $75/month for gym or fitness app membership
- **Standing desk:** Available on request
- **Ergonomic assessment:** IT will conduct one for remote employees

## Professional Development

- **Learning budget:** $1,500/year for courses, books, conferences
- **Conference attendance:** Additional budget for role-relevant industry conferences
- **Internal training:** Free access to all courses on this platform

## How to Access Benefits

1. Log in to the benefits portal (link in your onboarding email)
2. Complete enrollment within 30 days of your start date
3. Contact HR for questions: hr@company.com`,
          },
          {
            title: "Benefits Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 75 }),
            quizQuestions: [
              {
                text: "What is the company's 401(k) match percentage?",
                options: [
                  { text: "2%", isCorrect: false },
                  { text: "4%", isCorrect: true },
                  { text: "6%", isCorrect: false },
                  { text: "10%", isCorrect: false },
                ],
              },
              {
                text: "How many free EAP counselling sessions are available per year?",
                options: [
                  { text: "4", isCorrect: false },
                  { text: "6", isCorrect: false },
                  { text: "8", isCorrect: true },
                  { text: "12", isCorrect: false },
                ],
              },
              {
                text: "How long do you have to enroll in benefits after your start date?",
                options: [
                  { text: "7 days", isCorrect: false },
                  { text: "14 days", isCorrect: false },
                  { text: "30 days", isCorrect: true },
                  { text: "60 days", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Performance & Growth",
        lessons: [
          {
            title: "Performance Management Cycle",
            type: LessonType.TEXT,
            content: `# Performance Management Cycle

Understanding how performance is evaluated and rewarded helps you set goals, seek feedback, and grow in your role.

## The Annual Cycle

| Quarter | Activity |
|---|---|
| Q1 | Prior-year review + bonus payout |
| Q1 | Goal-setting for new year |
| Q2 | Mid-year check-in |
| Q4 | Year-end self-review + manager review |

## Goal Setting (OKRs)

We use the **Objectives and Key Results (OKR)** framework:
- **Objective:** A qualitative, inspiring goal ("Improve customer onboarding experience")
- **Key Result:** A measurable outcome ("Reduce time-to-first-value from 14 to 7 days")

Typically 2–4 objectives per person, each with 2–3 key results.

## Performance Ratings

| Rating | Description |
|---|---|
| Exceeds Expectations | Consistently delivers above and beyond |
| Meets Expectations | Reliably delivers on commitments |
| Needs Improvement | Not meeting key expectations |

## Continuous Feedback

Don't wait for the annual review. We encourage:
- **Weekly 1:1s** with your manager
- **Real-time feedback** (positive and constructive) via Slack or in-person
- **Peer feedback** during the review cycle

## Career Progression

Career levels are documented in the Engineering/Operations/Sales career ladders (available on the intranet). Promotions happen at the annual review cycle, based on sustained performance at the next level.`,
          },
          {
            title: "Onboarding Completion",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "When does goal-setting for the new year occur?",
                options: [
                  { text: "Q4", isCorrect: false },
                  { text: "Q1", isCorrect: true },
                  { text: "Q2", isCorrect: false },
                  { text: "Q3", isCorrect: false },
                ],
              },
              {
                text: "What does OKR stand for?",
                options: [
                  { text: "Outcomes, Knowledge, Results", isCorrect: false },
                  { text: "Objectives, Knowledge, Reviews", isCorrect: false },
                  { text: "Objectives and Key Results", isCorrect: true },
                  { text: "Operations and Key Risks", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CYBERSECURITY INTERNAL (requires both onboardings + cybersecurity clearance)
  // ─────────────────────────────────────────────────────────────────────────
  {
    title: "Advanced Cybersecurity Practitioner",
    description:
      "Deep-dive technical training for cybersecurity team members. Covers threat hunting, incident response, penetration testing fundamentals, and security architecture. Requires cybersecurity clearance.",
    category: "cybersecurity",
    requiredClearance: "cybersecurity",
    prerequisiteTitles: ["Cybersecurity Onboarding", "HR Onboarding"],
    modules: [
      {
        title: "Threat Intelligence & Hunting",
        lessons: [
          {
            title: "Threat Intelligence Fundamentals",
            type: LessonType.TEXT,
            content: `# Threat Intelligence Fundamentals

Threat intelligence is evidence-based knowledge about adversaries — their capabilities, motivations, infrastructure, and tactics — used to make informed security decisions.

## Types of Threat Intelligence

### Strategic
High-level intelligence for leadership and decision-makers:
- Geopolitical threat landscape
- Industry-targeting trends
- Long-term adversary campaigns

### Tactical
Detailed TTPs (Tactics, Techniques, and Procedures) for security teams:
- MITRE ATT&CK techniques used by specific threat actors
- Attack chain analysis
- Malware behaviour patterns

### Operational
Real-time or near-real-time intelligence about active threats:
- Indicators of Compromise (IoCs) — IPs, domains, hashes
- Active campaigns targeting our sector
- Zero-day vulnerability exploitation in the wild

### Technical
Specific artefacts for detection and blocking:
- YARA rules
- Snort/Suricata signatures
- STIX/TAXII feeds

## Intelligence Cycle

1. **Direction** — define intelligence requirements
2. **Collection** — gather raw data from internal and external sources
3. **Processing** — normalise and correlate data
4. **Analysis** — derive insights from processed data
5. **Dissemination** — share actionable intelligence with stakeholders
6. **Feedback** — evaluate effectiveness and refine

## Key Sources

- **OSINT:** VirusTotal, Shodan, MISP
- **Commercial:** CrowdStrike, Recorded Future, Mandiant
- **ISACs:** Information Sharing and Analysis Centers
- **Internal:** SIEM alerts, EDR telemetry, honeypots`,
          },
          {
            title: "Threat Hunting Methodology",
            type: LessonType.TEXT,
            content: `# Threat Hunting Methodology

Threat hunting is the proactive search for attackers who have evaded automated defences. Unlike reactive incident response, hunting assumes compromise and looks for hidden adversary activity.

## Hunt Hypothesis Models

### IoC-Driven
Start with a specific indicator (IP, domain, hash) from threat intelligence and search for evidence of it in your environment.

*Example:* "Has this C2 IP appeared in any DNS queries in the last 90 days?"

### TTP-Driven
Start with a technique from MITRE ATT&CK and hunt for evidence of that behaviour regardless of which actor performed it.

*Example:* "Are any processes injecting into lsass.exe?" (Credential Access: T1003.001)

### Anomaly-Driven
Start with a statistical baseline and look for deviations — unusual process trees, abnormal network destinations, off-hours logins.

## Hunt Process

1. **Define the hypothesis** — what are you looking for and why?
2. **Identify data sources** — EDR, SIEM, NetFlow, DNS logs
3. **Develop queries** — Splunk SPL, KQL, Sigma rules
4. **Execute and iterate** — adjust based on findings
5. **Document findings** — even negative results are valuable
6. **Automate detections** — convert successful hunts into detection rules

## Common Hunt Targets

| Technique | MITRE ID | What to Look For |
|---|---|---|
| PowerShell abuse | T1059.001 | Encoded commands, unusual parent processes |
| Living-off-the-land | T1218 | certutil, regsvr32, mshta executing remotely |
| Lateral movement | T1021 | PsExec, WMI, unusual RDP sources |
| Data exfiltration | T1048 | Large DNS queries, unusual HTTPS destinations |
| Persistence | T1547 | New scheduled tasks, registry run keys |`,
          },
          {
            title: "MITRE ATT&CK Framework",
            type: LessonType.VIDEO,
            content: "https://www.youtube.com/embed/Ysp_NG5vpoc",
          },
          {
            title: "Threat Intelligence Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "Which type of threat intelligence is most useful for a SOC analyst investigating an active alert?",
                options: [
                  { text: "Strategic", isCorrect: false },
                  { text: "Operational", isCorrect: true },
                  { text: "Financial", isCorrect: false },
                  { text: "Management", isCorrect: false },
                ],
              },
              {
                text: "What does TTP stand for in threat intelligence?",
                options: [
                  { text: "Tools, Techniques, and Platforms", isCorrect: false },
                  { text: "Targets, Threats, and Profiles", isCorrect: false },
                  { text: "Tactics, Techniques, and Procedures", isCorrect: true },
                  { text: "Threats, Tracking, and Prevention", isCorrect: false },
                ],
              },
              {
                text: "Which threat hunting model starts with a statistical baseline and looks for deviations?",
                options: [
                  { text: "IoC-Driven", isCorrect: false },
                  { text: "TTP-Driven", isCorrect: false },
                  { text: "Anomaly-Driven", isCorrect: true },
                  { text: "Hypothesis-Driven", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Incident Response",
        lessons: [
          {
            title: "Incident Response Lifecycle",
            type: LessonType.TEXT,
            content: `# Incident Response Lifecycle

Incident response (IR) is the structured approach to handling security incidents. A well-run IR process minimises damage, recovery time, and cost.

## NIST IR Framework Phases

### 1. Preparation
Set up the IR programme before incidents occur:
- Build and train the IR team
- Create and maintain the IR playbook
- Set up tooling: SIEM, EDR, forensic workstations, communication channels
- Establish relationships with legal, communications, and executive teams
- Run tabletop exercises

### 2. Detection & Analysis
Identify and validate that an incident has occurred:
- Monitor alerts from SIEM, EDR, IDS/IPS
- Correlate events across multiple data sources
- Determine scope, severity, and affected systems
- Assign a severity level (Critical/High/Medium/Low)
- Notify stakeholders per the escalation matrix

### 3. Containment
Prevent the incident from spreading:
- **Short-term:** Isolate affected systems (network segmentation, kill switch)
- **Long-term:** Remove attacker access, close entry points
- Preserve forensic evidence before remediation

### 4. Eradication
Remove the attacker and their tools:
- Delete malware and attacker-created accounts
- Patch exploited vulnerabilities
- Reset compromised credentials
- Verify eradication across all affected systems

### 5. Recovery
Restore systems to normal operation:
- Restore from clean backups where needed
- Monitor for re-compromise
- Gradually return systems to production

### 6. Post-Incident Activity
Learn from what happened:
- Write the post-incident report within 72 hours
- Conduct a blameless post-mortem
- Update playbooks, detection rules, and training`,
          },
          {
            title: "Digital Forensics Basics",
            type: LessonType.TEXT,
            content: `# Digital Forensics Basics

Digital forensics is the collection, preservation, and analysis of digital evidence in a way that is legally defensible.

## Order of Volatility

Evidence should be collected in order of most to least volatile. Volatile data is lost when systems are powered off.

1. CPU registers and cache
2. Routing tables, ARP cache, process tables
3. Memory (RAM)
4. Temporary file systems
5. Disk/storage
6. Remote logging and monitoring data
7. Physical configuration, network topology

## Memory Forensics

**Why memory matters:**
- Malware may exist only in memory (fileless malware)
- Encryption keys, plaintext credentials, network connections visible in RAM
- Process injection and hollowing detected in memory

**Tools:** Volatility, Rekall, WinPMEM

**Key artefacts:**
- Running processes and parent-child relationships
- Network connections (established, listening)
- Injected code in legitimate processes
- Loaded DLLs and hooks

## Disk Forensics

- Acquire a forensic image (bit-for-bit copy) — never work on originals
- Calculate and verify hash (MD5/SHA-256) before and after acquisition
- Tools: FTK Imager, dd, Autopsy, X-Ways

## Chain of Custody

Every piece of evidence must have a documented chain of custody:
- Who collected it, when, and where
- How it was stored and transported
- Who accessed it and for what purpose

Without chain of custody, evidence may be inadmissible in legal proceedings.`,
          },
          {
            title: "Incident Response Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "In the NIST IR framework, which phase immediately follows Detection & Analysis?",
                options: [
                  { text: "Eradication", isCorrect: false },
                  { text: "Recovery", isCorrect: false },
                  { text: "Containment", isCorrect: true },
                  { text: "Preparation", isCorrect: false },
                ],
              },
              {
                text: "Why is RAM collected before disk during forensic evidence collection?",
                options: [
                  { text: "RAM is easier to collect", isCorrect: false },
                  { text: "RAM contains more evidence", isCorrect: false },
                  { text: "RAM is volatile — it is lost when the system powers off", isCorrect: true },
                  { text: "Disk data can be recovered later", isCorrect: false },
                ],
              },
              {
                text: "What is the purpose of a chain of custody?",
                options: [
                  { text: "To speed up the forensic analysis", isCorrect: false },
                  { text: "To document who handled evidence and maintain its integrity for legal proceedings", isCorrect: true },
                  { text: "To encrypt sensitive evidence", isCorrect: false },
                  { text: "To share evidence with law enforcement", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Security Architecture & Hardening",
        lessons: [
          {
            title: "Zero Trust Architecture",
            type: LessonType.TEXT,
            content: `# Zero Trust Architecture

Zero Trust is a security model that operates on the principle **"never trust, always verify"**. It abandons the traditional perimeter-based model where users inside the network are inherently trusted.

## Core Principles

### Verify Explicitly
Always authenticate and authorise based on all available data points:
- Identity (who is the user?)
- Device health (is the device compliant?)
- Location (is this an expected location?)
- Service/workload (what are they accessing?)
- Data classification (how sensitive is it?)
- Behaviour analytics (does this match normal patterns?)

### Use Least Privilege Access
Limit user access with just-in-time (JIT) and just-enough-access (JEA):
- Time-bound access for elevated privileges
- Attribute-based access control (ABAC)
- Segregation of duties

### Assume Breach
Design as if attackers are already inside:
- Segment networks to limit lateral movement
- Encrypt all data in transit and at rest
- Use analytics to detect anomalies
- Minimise blast radius of any compromise

## Implementation Pillars

| Pillar | Technology Examples |
|---|---|
| Identity | Azure AD, Okta, MFA, Conditional Access |
| Devices | MDM, EDR, device compliance policies |
| Applications | CASB, app proxy, WAF, API gateway |
| Data | DLP, rights management, classification labels |
| Infrastructure | Micro-segmentation, IaC security scanning |
| Network | SD-WAN, ZTNA, DNS filtering |

## Migration Path

1. Inventory all users, devices, and applications
2. Implement MFA everywhere
3. Deploy endpoint management and compliance policies
4. Segment the network by sensitivity
5. Shift to identity-centric access policies
6. Continuously monitor and improve`,
          },
          {
            title: "System Hardening Guide",
            type: LessonType.TEXT,
            content: `# System Hardening Guide

System hardening reduces the attack surface by removing unnecessary functionality and securing default configurations.

## CIS Benchmarks

The Center for Internet Security (CIS) publishes hardening benchmarks for most operating systems, cloud platforms, and applications. Use these as your baseline.

**Levels:**
- **Level 1:** Basic hardening, minimal impact to usability
- **Level 2:** Strict hardening, may impact some functionality

## Windows Hardening

**Critical settings:**
- Enable BitLocker with TPM
- Disable LLMNR and NetBIOS (enables NTLM relay attacks)
- Restrict PowerShell execution policy (Constrained Language Mode)
- Enable Windows Defender Credential Guard (protect LSASS)
- Configure Windows Firewall with explicit allow-list rules
- Disable SMBv1 (EternalBlue exploit vector)
- Enable audit logging (logon events, process creation, object access)

## Linux Hardening

- Remove or disable unused services: systemctl disable <service>
- Configure SSH: disable root login, use key-based auth only, change default port
- Enable SELinux or AppArmor in enforcing mode
- Set up auditd for comprehensive system audit logging
- Configure automatic security updates (unattended-upgrades)
- Use UFW or iptables with restrictive ingress rules
- Mount /tmp and /var/tmp with noexec,nosuid options

## Cloud Hardening

- Enable cloud-native CSPM (AWS Security Hub, Azure Defender)
- Enforce resource tagging and budget alerts
- Disable public access to S3 buckets / Storage Accounts by default
- Enable MFA delete on S3
- Use private endpoints for database services
- Rotate access keys regularly and use IAM roles where possible`,
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. HR INTERNAL (requires both onboardings + hr clearance)
  // ─────────────────────────────────────────────────────────────────────────
  {
    title: "Advanced HR Operations",
    description:
      "Internal HR training covering employment law, compensation benchmarking, investigations, workforce planning, and strategic HR. Requires HR clearance.",
    category: "hr",
    requiredClearance: "hr",
    prerequisiteTitles: ["Cybersecurity Onboarding", "HR Onboarding"],
    modules: [
      {
        title: "Employment Law & Compliance",
        lessons: [
          {
            title: "US Employment Law Fundamentals",
            type: LessonType.TEXT,
            content: `# US Employment Law Fundamentals

HR professionals must understand the legal framework governing the employment relationship. This lesson covers the key federal laws that affect day-to-day HR decisions.

## Anti-Discrimination Laws

### Title VII of the Civil Rights Act (1964)
Prohibits employment discrimination based on **race, colour, religion, sex, or national origin**. Applies to employers with 15+ employees. Covers hiring, firing, pay, promotion, and all other terms of employment.

### Americans with Disabilities Act (ADA)
Prohibits discrimination against qualified individuals with disabilities. Requires **reasonable accommodation** unless it would cause undue hardship. Key HR obligations:
- Engage in the interactive process when accommodation is requested
- Do not ask about disabilities during the hiring process
- Maintain medical records separately from personnel files

### Age Discrimination in Employment Act (ADEA)
Protects employees **40 and older** from discrimination. Applies to all employment decisions.

### Pregnancy Discrimination Act (PDA)
Prohibits discrimination based on pregnancy, childbirth, or related conditions.

### Equal Pay Act (EPA)
Requires equal pay for equal work regardless of sex.

## Wage & Hour Laws

### Fair Labor Standards Act (FLSA)
- Establishes federal minimum wage
- Requires overtime pay (1.5×) for non-exempt employees working 40+ hours/week
- Defines exempt vs. non-exempt status based on duties and salary

**Misclassification** of exempt/non-exempt or employee/contractor is a major compliance risk with significant back-pay liability.

## Family & Medical Leave Act (FMLA)
Provides up to **12 weeks of unpaid, job-protected leave** per year for:
- Birth or adoption of a child
- Serious health condition (employee or immediate family)
- Qualifying military exigency

Applies to employers with 50+ employees. Employees must have 12 months of service and 1,250 hours worked.`,
          },
          {
            title: "Managing Accommodation Requests",
            type: LessonType.TEXT,
            content: `# Managing Accommodation Requests

Handling accommodation requests correctly protects both employees and the organisation.

## The Interactive Process

When an employee requests an accommodation (or when you become aware they may need one), you are legally required to engage in an **interactive process** — a good-faith dialogue to identify an effective accommodation.

### Steps

1. **Acknowledge the request** — confirm receipt in writing within 5 business days
2. **Request documentation** — you may ask for medical documentation, but only to establish:
   - The existence of a disability
   - The functional limitations
   - Why the requested accommodation is necessary
3. **Explore options** — identify accommodations that would be effective; you don't have to provide the specific accommodation requested if alternatives are effective
4. **Assess undue hardship** — consider cost, operational disruption, and safety
5. **Communicate the decision** — in writing, with rationale
6. **Monitor** — check in regularly; needs may change

## Common Accommodations

- Modified schedule or remote work
- Ergonomic equipment (standing desk, specialised keyboard)
- Extended deadlines or reduced workload (temporary)
- Leave of absence (ADA may require leave beyond FMLA)
- Reassignment to a vacant position (last resort)

## Documentation

Maintain an accommodation file **separate from the employee's personnel file**. Document:
- The request
- Medical information provided
- Options explored
- Decision and rationale
- Ongoing monitoring

## What NOT to Do

- Do not ask employees to "just push through" without engaging in the process
- Do not deny requests without exploring alternatives
- Do not disclose medical information to managers or colleagues beyond what is necessary`,
          },
          {
            title: "Employment Law Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "Under the FMLA, how many weeks of leave are employees entitled to per year?",
                options: [
                  { text: "6 weeks", isCorrect: false },
                  { text: "8 weeks", isCorrect: false },
                  { text: "12 weeks", isCorrect: true },
                  { text: "16 weeks", isCorrect: false },
                ],
              },
              {
                text: "What is the term for the required dialogue between employer and employee when an accommodation is requested?",
                options: [
                  { text: "Disability assessment", isCorrect: false },
                  { text: "The interactive process", isCorrect: true },
                  { text: "Medical review", isCorrect: false },
                  { text: "Reasonable inquiry", isCorrect: false },
                ],
              },
              {
                text: "Which act requires equal pay for equal work regardless of sex?",
                options: [
                  { text: "Title VII", isCorrect: false },
                  { text: "ADA", isCorrect: false },
                  { text: "Equal Pay Act", isCorrect: true },
                  { text: "ADEA", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Compensation & Total Rewards",
        lessons: [
          {
            title: "Compensation Benchmarking",
            type: LessonType.TEXT,
            content: `# Compensation Benchmarking

Competitive compensation is critical for attracting and retaining talent. Benchmarking ensures our pay is aligned to the market.

## Market Data Sources

| Source | Best Used For |
|---|---|
| Radford / Aon | Technology sector, equity data |
| Mercer | Broad industry coverage |
| Willis Towers Watson | Global data, executive comp |
| Levels.fyi | Tech industry transparency (public) |
| Bureau of Labor Statistics | Regulatory compliance, government benchmarking |

## Matching Roles to Survey Jobs

Survey jobs are generic descriptions — they won't match your job titles exactly. Match on:
- **Scope** (individual contributor vs. manager, team size)
- **Function** (engineering, sales, HR)
- **Level** (years of experience, impact, decision-making authority)

**Avoid:** Inflating matches to justify higher pay. Match based on actual duties.

## Interpreting Percentile Data

| Percentile | Meaning |
|---|---|
| 25th | Below market — used for lower-cost locations or lower performance |
| 50th (median) | Market rate — our target for new hires |
| 75th | Premium — used for critical roles or top talent retention |
| 90th | Premium+ — rarely used, only for unique/scarce skills |

## Pay Equity Analysis

Run a regression analysis annually to identify unexplained pay gaps by gender, race, or other protected characteristics. Control for:
- Role/job family
- Level/grade
- Location
- Tenure
- Performance rating

Unexplained gaps require remediation — not just documentation.`,
          },
          {
            title: "Incentive Compensation Design",
            type: LessonType.TEXT,
            content: `# Incentive Compensation Design

Well-designed incentive plans drive the behaviours that lead to business outcomes. Poorly designed ones create unintended consequences.

## Types of Incentive Plans

### Short-Term Incentives (STI)
Annual or quarterly bonuses tied to performance metrics.

**Design considerations:**
- Performance measures: financial (revenue, profit), operational (NPS, retention), or individual goals
- Target payout: typically 10–30% of base salary depending on level
- Threshold / target / stretch: three performance tiers with increasing payouts
- Funding: company performance gates individual payouts (low company performance = reduced pool)

### Long-Term Incentives (LTI)
Equity-based compensation that vests over time.

**Vehicles:**
- **Stock Options** — right to buy shares at the grant price; valuable if stock price rises
- **RSUs** — shares granted subject to vesting; value tied to current stock price
- **Performance Shares** — RSUs with performance conditions (revenue targets, TSR)

**Vesting schedules:**
- Standard: 4-year / 1-year cliff
- Accelerated: Single-trigger (acquisition) or double-trigger (acquisition + termination)

## Avoiding Common Design Flaws

| Flaw | Risk |
|---|---|
| Too many metrics | Employees don't know what to focus on |
| Cap too low | Disincentivises outperformance |
| No threshold | Guarantees payout even for poor performance |
| Metrics not in employee's control | Disconnects effort from reward |
| No communication | Employees don't understand or value the plan |

## Plan Communication

An incentive plan only works if employees understand it. Hold an annual plan briefing covering:
- How the plan works
- What behaviours it rewards
- How individual payouts are calculated
- When payouts occur`,
          },
          {
            title: "Compensation Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "Which percentile is typically used as the target for new hire compensation?",
                options: [
                  { text: "25th percentile", isCorrect: false },
                  { text: "50th percentile", isCorrect: true },
                  { text: "75th percentile", isCorrect: false },
                  { text: "90th percentile", isCorrect: false },
                ],
              },
              {
                text: "What is the standard vesting schedule for equity grants?",
                options: [
                  { text: "2-year / 6-month cliff", isCorrect: false },
                  { text: "3-year / 1-year cliff", isCorrect: false },
                  { text: "4-year / 1-year cliff", isCorrect: true },
                  { text: "5-year / 2-year cliff", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
      {
        title: "Workforce Planning & Strategy",
        lessons: [
          {
            title: "Strategic Workforce Planning",
            type: LessonType.TEXT,
            content: `# Strategic Workforce Planning

Workforce planning bridges business strategy and talent. It ensures the organisation has the right people, with the right skills, in the right roles, at the right time.

## The Workforce Planning Process

### 1. Analyse Current State
Build a complete picture of your current workforce:
- Headcount by function, level, and location
- Skills inventory (technical and leadership)
- Attrition rates and retirement projections
- Current performance distribution
- Cost by function

### 2. Model Future Requirements
Based on business strategy, determine what you'll need in 1, 3, and 5 years:
- Revenue/growth targets and the headcount they imply
- New capabilities required (e.g., AI/ML skills for a digital transformation)
- Geographic expansion
- M&A integration needs

### 3. Gap Analysis
Compare current state to future requirements:
- **Surplus:** More people than needed (redeployment or reduction)
- **Gap:** Fewer people than needed (hiring or upskilling)
- **Skill mismatch:** Right number, wrong skills

### 4. Define Strategies

| Gap Type | Strategy Options |
|---|---|
| Quantity gap | Hire, contract, restructure |
| Skill gap | Train/upskill, reskill, hire, acquire |
| Location gap | Relocate, remote-enable, open new office |
| Succession gap | Internal development, external pipeline |

### 5. Implement & Monitor
Execute workforce plans and track KPIs:
- Time to fill open roles
- Internal mobility rate
- Skills coverage ratio
- Voluntary turnover rate by segment

## Critical Workforce Segments

Identify roles that are:
- **Scarce** — hard to hire or develop
- **Strategic** — disproportionate impact on business outcomes
- **At risk** — high turnover or retirement risk

Prioritise planning effort and retention investment on these segments.`,
          },
          {
            title: "HR Analytics & Metrics",
            type: LessonType.TEXT,
            content: `# HR Analytics & Metrics

Data-driven HR makes better decisions, demonstrates business value, and builds credibility with leadership.

## Core HR Metrics

| Metric | Formula | Benchmark |
|---|---|---|
| Voluntary turnover rate | (Voluntary terminations / Avg headcount) × 100 | 10–15% (varies by industry) |
| Time to fill | Days from open req to offer accepted | 30–45 days |
| Time to hire | Days from candidate application to offer | 20–30 days |
| Cost per hire | (Internal + external recruiting costs) / Hires | $4,000–$20,000 |
| Offer acceptance rate | Offers accepted / Offers extended | 85%+ |
| Internal mobility rate | Internal moves / Total hires | 20–30% |

## Predictive Analytics

Moving beyond descriptive (what happened) to predictive (what will happen):

### Attrition Prediction
Use machine learning models trained on historical data to identify employees at high flight risk. Features might include:
- Tenure in role
- Time since last promotion
- Manager effectiveness score
- Compensation vs. market
- Engagement survey score
- Absence patterns

### Hiring Quality
Correlate recruiting source, interview scores, and hiring manager with 12-month performance ratings to improve selection decisions.

## Building Your Metrics Dashboard

Recommended structure:
1. **Headline KPIs** — for executive audience (headcount, turnover, cost)
2. **Operational metrics** — for HR team (open reqs, time to fill, interview pipeline)
3. **Leading indicators** — for early warning (engagement, exit interview themes)

## Data Quality

Analytics is only as good as the underlying data. Priorities:
- Clean HRIS data (accurate job titles, levels, managers)
- Consistent job family taxonomy
- Timely data entry (hires, terminations, promotions)`,
          },
          {
            title: "Workforce Planning Quiz",
            type: LessonType.QUIZ,
            content: JSON.stringify({ passingScore: 80 }),
            quizQuestions: [
              {
                text: "What is the formula for voluntary turnover rate?",
                options: [
                  { text: "(Total terminations / Headcount) × 100", isCorrect: false },
                  { text: "(Voluntary terminations / Avg headcount) × 100", isCorrect: true },
                  { text: "Headcount / Voluntary terminations", isCorrect: false },
                  { text: "(Headcount - Terminations) / Headcount", isCorrect: false },
                ],
              },
              {
                text: "A workforce planning gap analysis shows you have fewer employees than needed. What type of gap is this?",
                options: [
                  { text: "Surplus", isCorrect: false },
                  { text: "Skill mismatch", isCorrect: false },
                  { text: "Quantity gap", isCorrect: true },
                  { text: "Location gap", isCorrect: false },
                ],
              },
              {
                text: "Which type of HR analytics predicts what will happen in the future?",
                options: [
                  { text: "Descriptive analytics", isCorrect: false },
                  { text: "Predictive analytics", isCorrect: true },
                  { text: "Prescriptive analytics", isCorrect: false },
                  { text: "Operational analytics", isCorrect: false },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

export async function seedCoursePackages(
  prisma: PrismaClient,
  adminId: string,
): Promise<void> {
  // First pass: create all courses (we need IDs for prerequisites)
  const courseIdMap = new Map<string, string>(); // title -> id

  for (const pkg of COURSE_PACKAGES) {
    const existing = await prisma.course.findFirst({ where: { title: pkg.title } });
    if (existing) {
      courseIdMap.set(pkg.title, existing.id);
      console.log(`Course already exists: ${pkg.title}`);
      continue;
    }

    const course = await prisma.course.create({
      data: {
        title: pkg.title,
        description: pkg.description,
        status: CourseStatus.PUBLISHED,
        category: pkg.category,
        requiredClearance: pkg.requiredClearance,
        createdById: adminId,
      },
    });
    courseIdMap.set(pkg.title, course.id);
    console.log(`Created course: ${pkg.title}`);
  }

  // Second pass: create modules, lessons, quiz questions
  for (const pkg of COURSE_PACKAGES) {
    const courseId = courseIdMap.get(pkg.title)!;

    const existingModules = await prisma.module.count({ where: { courseId } });
    if (existingModules > 0) {
      console.log(`Content already seeded for: ${pkg.title}`);
    } else {
      for (let mi = 0; mi < pkg.modules.length; mi++) {
        const mod = pkg.modules[mi];
        const createdModule = await prisma.module.create({
          data: { title: mod.title, order: mi + 1, courseId },
        });
        console.log(`  Module: ${mod.title}`);

        for (let li = 0; li < mod.lessons.length; li++) {
          const lessonDef = mod.lessons[li];
          const lesson = await prisma.lesson.create({
            data: {
              title: lessonDef.title,
              type: lessonDef.type,
              content: lessonDef.content,
              order: li + 1,
              moduleId: createdModule.id,
            },
          });
          console.log(`    Lesson: ${lessonDef.title} (${lessonDef.type})`);

          if (lessonDef.quizQuestions && lessonDef.quizQuestions.length > 0) {
            for (let qi = 0; qi < lessonDef.quizQuestions.length; qi++) {
              const q = lessonDef.quizQuestions[qi];
              const question = await prisma.quizQuestion.create({
                data: { text: q.text, order: qi + 1, lessonId: lesson.id },
              });
              for (let oi = 0; oi < q.options.length; oi++) {
                const opt = q.options[oi];
                await prisma.quizOption.create({
                  data: {
                    text: opt.text,
                    isCorrect: opt.isCorrect,
                    order: oi + 1,
                    questionId: question.id,
                  },
                });
              }
            }
            console.log(`      → ${lessonDef.quizQuestions.length} quiz questions seeded`);
          }
        }
      }
    }

    // Third pass: prerequisites (now all IDs are available)
    for (const prereqTitle of pkg.prerequisiteTitles) {
      const prerequisiteId = courseIdMap.get(prereqTitle);
      if (!prerequisiteId) {
        console.warn(`  WARNING: Prerequisite course not found: ${prereqTitle}`);
        continue;
      }
      await prisma.coursePrerequisite.upsert({
        where: { courseId_prerequisiteId: { courseId, prerequisiteId } },
        create: { courseId, prerequisiteId },
        update: {},
      });
      console.log(`  Prerequisite: ${pkg.title} requires ${prereqTitle}`);
    }
  }
}
