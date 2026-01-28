import { relations } from "drizzle-orm"
import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  decimal,
  smallint,
  index,
  uniqueIndex,
  uuid,
  jsonb,
  date,
} from "drizzle-orm/pg-core"

// Companies table - each cleaning business
export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    postcode: varchar("postcode", { length: 50 }),
    country: varchar("country", { length: 100 }).default("UK"),
    website: varchar("website", { length: 255 }),
    logo: varchar("logo", { length: 255 }),
    businessType: varchar("business_type", { length: 50 }),
    taxId: varchar("tax_id", { length: 100 }),
    numberOfEmployees: integer("number_of_employees").default(1),
    maxEmployees: integer("max_employees").default(5),
    employeeRate: decimal("employee_rate", { precision: 10, scale: 2 }).default("20.00"),
    monthlyPlanCost: decimal("monthly_plan_cost", { precision: 10, scale: 2 }).default("0.00"),
    subscriptionPlan: varchar("subscription_plan", { length: 50 }).notNull().default("trial"),
    subscriptionStatus: varchar("subscription_status", { length: 50 }).notNull().default("active"),
    notificationSettings: jsonb("notification_settings"),
    trialEndsAt: timestamp("trial_ends_at"),
    // Stripe integration
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("companies_email_idx").on(table.email),
  }),
)

// Features table - available features for companies
export const features = pgTable(
  "features",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).notNull().default("company"), // 'company' or 'employee'
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
    isCore: smallint("is_core").notNull().default(0), // Core features included by default
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("features_slug_idx").on(table.slug),
    typeIdx: index("features_type_idx").on(table.type),
  }),
)

// Company Features junction table - which features are enabled for each company
export const companyFeatures = pgTable(
  "company_features",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    featureId: integer("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    isEnabled: smallint("is_enabled").notNull().default(1),
    enabledAt: timestamp("enabled_at").defaultNow().notNull(),
    disabledAt: timestamp("disabled_at"),
  },
  (table) => ({
    companyFeatureIdx: uniqueIndex("company_features_company_feature_idx").on(table.companyId, table.featureId),
    companyIdx: index("company_features_company_idx").on(table.companyId),
  }),
)

// Users table - people who can log in
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    role: varchar("role", { length: 50 }).notNull().default("admin"),
    avatar: varchar("avatar", { length: 255 }),
    isActive: smallint("is_active").notNull().default(1),
    // Email verification
    emailVerified: smallint("email_verified").notNull().default(0),
    emailVerificationToken: varchar("email_verification_token", { length: 255 }),
    emailVerificationExpires: timestamp("email_verification_expires"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    companyIdx: index("users_company_idx").on(table.companyId),
    verificationTokenIdx: index("users_verification_token_idx").on(table.emailVerificationToken),
  }),
)

// Password reset tokens table
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("password_reset_tokens_token_idx").on(table.token),
    userIdx: index("password_reset_tokens_user_idx").on(table.userId),
  }),
)

// Sessions table - for persistent authentication across serverless instances
export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 255 }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id"), // For employee sessions
    companyId: integer("company_id").references(() => companies.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull().default("user"), // 'user' or 'employee'
    ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(table.token),
    userIdx: index("sessions_user_idx").on(table.userId),
    employeeIdx: index("sessions_employee_idx").on(table.employeeId),
    expiresIdx: index("sessions_expires_idx").on(table.expiresAt),
  }),
)

// Event log table - for tracking all important events in the system
export const eventLogs = pgTable(
  "event_logs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }), // 'job', 'invoice', 'customer', etc.
    entityId: integer("entity_id"),
    userId: integer("user_id"),
    employeeId: integer("employee_id"),
    description: text("description"),
    metadata: text("metadata"), // JSON string for additional data
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("event_logs_company_idx").on(table.companyId),
    eventTypeIdx: index("event_logs_event_type_idx").on(table.eventType),
    entityIdx: index("event_logs_entity_idx").on(table.entityType, table.entityId),
    createdIdx: index("event_logs_created_idx").on(table.createdAt),
  }),
)

// Customer feedback table - for tracking customer satisfaction
export const customerFeedback = pgTable(
  "customer_feedback",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id"), // References customers table
    jobId: integer("job_id"), // References jobs table
    rating: integer("rating").notNull(), // 1-5 stars
    comment: text("comment"),
    feedbackToken: varchar("feedback_token", { length: 255 }), // For secure public access
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    respondedAt: timestamp("responded_at"),
    response: text("response"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("customer_feedback_company_idx").on(table.companyId),
    customerIdx: index("customer_feedback_customer_idx").on(table.customerId),
    jobIdx: index("customer_feedback_job_idx").on(table.jobId),
    tokenIdx: index("customer_feedback_token_idx").on(table.feedbackToken),
  }),
)

export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Basic Information
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    alternatePhone: varchar("alternate_phone", { length: 50 }),

    // Login Credentials
    username: varchar("username", { length: 100 }),
    password: varchar("password", { length: 255 }),

    // Profile
    photo: varchar("photo", { length: 255 }),
    dateOfBirth: timestamp("date_of_birth"),

    // Address
    address: text("address"),
    city: varchar("city", { length: 100 }),
    postcode: varchar("postcode", { length: 50 }),
    country: varchar("country", { length: 100 }).default("UK"),

    // Employment Details
    role: varchar("role", { length: 100 }),
    employmentType: varchar("employment_type", { length: 50 }),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),

      // Compensation
      payType: varchar("pay_type", { length: 20 }).default("hourly"),
      hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
      salary: decimal("salary", { precision: 10, scale: 2 }),
      paymentFrequency: varchar("payment_frequency", { length: 50 }),

    // Skills & Certifications
    skills: text("skills"),
    certifications: text("certifications"),
    languages: text("languages"),

    // Performance & Availability
    performanceRating: decimal("performance_rating", { precision: 3, scale: 2 }),
    totalJobsCompleted: integer("total_jobs_completed").default(0),
    averageJobRating: decimal("average_job_rating", { precision: 3, scale: 2 }),
    availability: text("availability"),

    // Emergency Contact
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 50 }),
    emergencyContactRelation: varchar("emergency_contact_relation", { length: 100 }),

    // Additional Info
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("employees_company_idx").on(table.companyId),
    emailCompanyIdx: uniqueIndex("employees_email_company_idx").on(table.companyId, table.email),
    phoneCompanyIdx: uniqueIndex("employees_phone_company_idx").on(table.companyId, table.phone),
    usernameCompanyIdx: uniqueIndex("employees_username_company_idx").on(table.companyId, table.username),
    statusIdx: index("employees_status_idx").on(table.status),
    roleIdx: index("employees_role_idx").on(table.role),
  }),
)

// Customers table - clients who book cleaning services
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Basic Information
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    alternatePhone: varchar("alternate_phone", { length: 50 }),

    // Address Information
    address: text("address"),
    addressLine2: text("address_line_2"),
    city: varchar("city", { length: 100 }),
    postcode: varchar("postcode", { length: 50 }),
    country: varchar("country", { length: 100 }).default("UK"),

    // Customer Details
    customerType: varchar("customer_type", { length: 50 }).notNull().default("residential"),
    status: varchar("status", { length: 50 }).notNull().default("active"),

    // Billing Information
    billingAddress: text("billing_address"),
    billingCity: varchar("billing_city", { length: 100 }),
    billingPostcode: varchar("billing_postcode", { length: 50 }),
    billingCountry: varchar("billing_country", { length: 100 }).default("UK"),
    taxId: varchar("tax_id", { length: 100 }),

    // Service Preferences
    preferredContactMethod: varchar("preferred_contact_method", { length: 50 }),
    specialInstructions: text("special_instructions"),
    accessInstructions: text("access_instructions"),
    parkingInstructions: text("parking_instructions"),

    // Business Information (for commercial customers)
    companyName: varchar("company_name", { length: 255 }),
    businessType: varchar("business_type", { length: 100 }),

    // Metadata
    source: varchar("source", { length: 100 }),
    referredBy: varchar("referred_by", { length: 255 }),
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("customers_company_idx").on(table.companyId),
    emailCompanyIdx: uniqueIndex("customers_email_company_idx").on(table.companyId, table.email),
    phoneCompanyIdx: uniqueIndex("customers_phone_company_idx").on(table.companyId, table.phone),
    statusIdx: index("customers_status_idx").on(table.status),
    typeIdx: index("customers_type_idx").on(table.customerType),
    companyEmailIdx: uniqueIndex("customers_company_email_idx").on(table.companyId, table.email),
  }),
)

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 100 }),
    address: text("address").notNull(),
    addressLine2: text("address_line_2"),
    city: varchar("city", { length: 100 }),
    postcode: varchar("postcode", { length: 50 }),
    country: varchar("country", { length: 100 }).default("UK"),
    accessInstructions: text("access_instructions"),
    parkingInstructions: text("parking_instructions"),
    specialInstructions: text("special_instructions"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("customer_addresses_customer_idx").on(table.customerId),
  }),
)

// Teams - groups of employees
export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("teams_company_idx").on(table.companyId),
    nameCompanyIdx: uniqueIndex("teams_name_company_idx").on(table.companyId, table.name),
  }),
)

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    teamIdx: index("team_members_team_idx").on(table.teamId),
    employeeIdx: index("team_members_employee_idx").on(table.employeeId),
    uniqueMember: uniqueIndex("team_members_unique_member").on(table.teamId, table.employeeId),
  }),
)

export const cleaningPlans = pgTable(
  "cleaning_plans",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }),
    estimatedDuration: varchar("estimated_duration", { length: 100 }),
    price: decimal("price", { precision: 10, scale: 2 }),
    isActive: smallint("is_active").default(1),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("cleaning_plans_name_idx").on(table.name),
  }),
)

export const planTasks = pgTable(
  "plan_tasks",
  {
    id: serial("id").primaryKey(),
    planId: integer("plan_id")
      .notNull()
      .references(() => cleaningPlans.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    order: integer("order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index("plan_tasks_plan_idx").on(table.planId),
  }),
)

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Basic Information
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    jobType: varchar("job_type", { length: 100 }),

    // Customer & Assignment
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    assignedTo: integer("assigned_to").references(() => employees.id, { onDelete: "set null" }),
    teamMembers: text("team_members"),

    // Location
    location: text("location"),
    addressLine2: text("address_line_2"),
    city: varchar("city", { length: 100 }),
    postcode: varchar("postcode", { length: 50 }),
    accessInstructions: text("access_instructions"),
    parkingInstructions: text("parking_instructions"),
    specialInstructions: text("special_instructions"),

    // Scheduling
    scheduledFor: timestamp("scheduled_for"),
    scheduledEnd: timestamp("scheduled_end"),
    durationMinutes: integer("duration_minutes").default(60),

    // Recurrence
    recurrence: varchar("recurrence", { length: 50 }),
    recurrenceEndDate: timestamp("recurrence_end_date"),
    parentJobId: integer("parent_job_id").references(() => jobs.id, { onDelete: "set null" }),

    // Contract Link
    contractId: integer("contract_id").references(() => contracts.id, { onDelete: "set null" }),

    // Status & Progress
    status: varchar("status", { length: 50 }).notNull().default("scheduled"),
    priority: varchar("priority", { length: 50 }).default("normal"),
    completedAt: timestamp("completed_at"),

    // Acceptance flags - both must accept before customer confirmation is sent
    employeeAccepted: smallint("employee_accepted").default(0),
    employeeAcceptedAt: timestamp("employee_accepted_at"),
    customerConfirmationSent: smallint("customer_confirmation_sent").default(0),
    customerConfirmationSentAt: timestamp("customer_confirmation_sent_at"),

    // Pricing
    estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
    actualPrice: decimal("actual_price", { precision: 10, scale: 2 }),
    employeePay: decimal("employee_pay", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 10 }).default("GBP"),

    // Quality & Feedback
    qualityRating: decimal("quality_rating", { precision: 3, scale: 2 }),
    customerFeedback: text("customer_feedback"),
    feedbackToken: varchar("feedback_token", { length: 255 }), // Token for secure public feedback
    internalNotes: text("internal_notes"),

    // References
    planId: integer("plan_id").references(() => cleaningPlans.id, { onDelete: "set null" }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("jobs_company_idx").on(table.companyId),
    customerIdx: index("jobs_customer_idx").on(table.customerId),
    assigneeIdx: index("jobs_assignee_idx").on(table.assignedTo),
    statusIdx: index("jobs_status_idx").on(table.status),
    scheduledIdx: index("jobs_scheduled_idx").on(table.scheduledFor),
    planIdx: index("jobs_plan_idx").on(table.planId),
    jobTypeIdx: index("jobs_type_idx").on(table.jobType),
    feedbackTokenIdx: index("jobs_feedback_token_idx").on(table.feedbackToken),
  }),
)

export const jobAssignments = pgTable(
  "job_assignments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    payAmount: decimal("pay_amount", { precision: 10, scale: 2 }),
    status: varchar("status", { length: 50 }).notNull().default("assigned"), // assigned, accepted, declined, completed
    acceptedAt: timestamp("accepted_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("job_assignments_job_idx").on(table.jobId),
    employeeIdx: index("job_assignments_employee_idx").on(table.employeeId),
    companyIdx: index("job_assignments_company_idx").on(table.companyId),
    uniqueAssignment: uniqueIndex("job_assignments_unique").on(table.jobId, table.employeeId),
  }),
)

export const jobTasks = pgTable(
  "job_tasks",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    order: integer("order").default(0),
    completedBy: integer("completed_by").references(() => employees.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("job_tasks_job_idx").on(table.jobId),
    completedIdx: index("job_tasks_completed_idx").on(table.completedAt),
  }),
)

// Task verification photos - with GPS and metadata for proof of completion
export const taskVerificationPhotos = pgTable(
  "task_verification_photos",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    taskId: integer("task_id")
      .references(() => jobTasks.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Photo file info
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    url: varchar("url", { length: 500 }).notNull(),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),

    // GPS Location verification
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    locationAccuracy: decimal("location_accuracy", { precision: 10, scale: 2 }), // meters
    capturedAddress: text("captured_address"), // Reverse geocoded address

    // Device info
    deviceType: varchar("device_type", { length: 100 }), // iOS, Android, Web
    deviceModel: varchar("device_model", { length: 255 }),
    userAgent: text("user_agent"),

    // Verification metadata
    capturedAt: timestamp("captured_at").notNull(), // When photo was actually taken
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(), // When uploaded to server
    verificationStatus: varchar("verification_status", { length: 50 }).default("pending"), // pending, verified, flagged
    distanceFromJobSite: decimal("distance_from_job_site", { precision: 10, scale: 2 }), // meters from job location
    
    // Notes
    caption: text("caption"),
    notes: text("notes"),
  },
  (table) => ({
    companyIdx: index("task_photos_company_idx").on(table.companyId),
    jobIdx: index("task_photos_job_idx").on(table.jobId),
    taskIdx: index("task_photos_task_idx").on(table.taskId),
    employeeIdx: index("task_photos_employee_idx").on(table.employeeId),
    capturedIdx: index("task_photos_captured_idx").on(table.capturedAt),
  }),
)

// GPS Check-ins/Check-outs - for tracking employee arrival and departure
export const jobCheckIns = pgTable(
  "job_check_ins",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Check-in type
    type: varchar("type", { length: 20 }).notNull(), // 'check_in' or 'check_out'

    // GPS Location
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    locationAccuracy: decimal("location_accuracy", { precision: 10, scale: 2 }), // meters
    capturedAddress: text("captured_address"),

    // Distance verification
    distanceFromJobSite: decimal("distance_from_job_site", { precision: 10, scale: 2 }), // meters
    isWithinRange: smallint("is_within_range").default(0), // 1 if within acceptable range

    // Device info
    deviceType: varchar("device_type", { length: 100 }),
    deviceModel: varchar("device_model", { length: 255 }),
    userAgent: text("user_agent"),

    // Timestamps
    checkedAt: timestamp("checked_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("job_check_ins_company_idx").on(table.companyId),
    jobIdx: index("job_check_ins_job_idx").on(table.jobId),
    employeeIdx: index("job_check_ins_employee_idx").on(table.employeeId),
    typeIdx: index("job_check_ins_type_idx").on(table.type),
    checkedAtIdx: index("job_check_ins_checked_at_idx").on(table.checkedAt),
  }),
)

// Customer Signatures - for job completion sign-off
export const customerSignatures = pgTable(
  "customer_signatures",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .references(() => customers.id, { onDelete: "set null" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Signature data
    signatureData: text("signature_data").notNull(), // Base64 encoded signature image
    signerName: varchar("signer_name", { length: 255 }).notNull(),
    signerEmail: varchar("signer_email", { length: 255 }),

    // Customer feedback
    rating: smallint("rating"), // 1-5 stars
    feedback: text("feedback"),
    
    // GPS Location where signed
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    signedAddress: text("signed_address"),

    // Device info
    deviceType: varchar("device_type", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 50 }),

    // Timestamps
    signedAt: timestamp("signed_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("customer_signatures_company_idx").on(table.companyId),
    jobIdx: uniqueIndex("customer_signatures_job_idx").on(table.jobId), // One signature per job
    customerIdx: index("customer_signatures_customer_idx").on(table.customerId),
    employeeIdx: index("customer_signatures_employee_idx").on(table.employeeId),
    signedAtIdx: index("customer_signatures_signed_at_idx").on(table.signedAt),
  }),
)

// Time-Off Requests - for employees to request leave/vacation
export const timeOffRequests = pgTable(
  "time_off_requests",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    // Request details
    type: varchar("type", { length: 50 }).notNull(), // vacation, sick, personal, unpaid, other
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    totalDays: decimal("total_days", { precision: 5, scale: 1 }).notNull(), // Supports half days
    reason: text("reason"),

    // Status tracking
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, denied, cancelled
    
    // Approval info
    reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("time_off_requests_company_idx").on(table.companyId),
    employeeIdx: index("time_off_requests_employee_idx").on(table.employeeId),
    statusIdx: index("time_off_requests_status_idx").on(table.status),
    startDateIdx: index("time_off_requests_start_date_idx").on(table.startDate),
    reviewedByIdx: index("time_off_requests_reviewed_by_idx").on(table.reviewedBy),
  }),
)

export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),

    // Financial Details
    currency: varchar("currency", { length: 10 }).notNull().default("GBP"),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
    discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
    amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull().default("0"),
    amountDue: decimal("amount_due", { precision: 12, scale: 2 }).notNull().default("0"),

    // Status and Dates
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    issuedAt: timestamp("issued_at"),
    dueAt: timestamp("due_at"),
    paidAt: timestamp("paid_at"),

    // Additional Info
    notes: text("notes"),
    terms: text("terms"),
    footer: text("footer"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("invoices_company_idx").on(table.companyId),
    invoiceNumberIdx: uniqueIndex("invoices_invoice_number_idx").on(table.companyId, table.invoiceNumber),
    customerIdx: index("invoices_customer_idx").on(table.customerId),
    statusIdx: index("invoices_status_idx").on(table.status),
    issuedIdx: index("invoices_issued_idx").on(table.issuedAt),
    dueIdx: index("invoices_due_idx").on(table.dueAt),
  }),
)

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: serial("id").primaryKey(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    taxable: smallint("taxable").default(1),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    invoiceIdx: index("invoice_items_invoice_idx").on(table.invoiceId),
  }),
)

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    // Payment Details
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("GBP"),
    method: varchar("method", { length: 50 }).notNull().default("cash"),
    status: varchar("status", { length: 50 }).notNull().default("completed"),

    // Transaction Info
    transactionId: varchar("transaction_id", { length: 255 }),
    reference: varchar("reference", { length: 255 }),
    notes: text("notes"),

    // Dates
    paidAt: timestamp("paid_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("payments_company_idx").on(table.companyId),
    invoiceIdx: index("payments_invoice_idx").on(table.invoiceId),
    customerIdx: index("payments_customer_idx").on(table.customerId),
    statusIdx: index("payments_status_idx").on(table.status),
    paidAtIdx: index("payments_paid_at_idx").on(table.paidAt),
  }),
)

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    employeeId: integer("employee_id").references(() => employees.id, { onDelete: "set null" }),

    // Expense Details
    category: varchar("category", { length: 100 }).notNull(),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("GBP"),

    // Payment Info
    paymentMethod: varchar("payment_method", { length: 50 }),
    vendor: varchar("vendor", { length: 255 }),
    receiptNumber: varchar("receipt_number", { length: 255 }),

    // Attachments
    receiptUrl: varchar("receipt_url", { length: 255 }),

    // Tax & Accounting
    taxDeductible: smallint("tax_deductible").notNull().default(1),
    notes: text("notes"),

    // Dates
    expenseDate: timestamp("expense_date").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("expenses_company_idx").on(table.companyId),
    jobIdx: index("expenses_job_idx").on(table.jobId),
    categoryIdx: index("expenses_category_idx").on(table.category),
    expenseDateIdx: index("expenses_expense_date_idx").on(table.expenseDate),
  }),
)

export const jobEvents = pgTable(
  "job_events",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    actorId: integer("actor_id").references(() => employees.id, { onDelete: "set null" }),
    type: varchar("type", { length: 100 }).notNull(),
    message: text("message"),
    meta: text("meta"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    jobIdx: index("job_events_job_idx").on(table.jobId),
    actorIdx: index("job_events_actor_idx").on(table.actorId),
  }),
)

export const workSessions = pgTable(
  "work_sessions",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    durationMinutes: integer("duration_minutes"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    employeeIdx: index("work_sessions_employee_idx").on(table.employeeId),
    jobIdx: index("work_sessions_job_idx").on(table.jobId),
    startedIdx: index("work_sessions_started_idx").on(table.startedAt),
  }),
)

export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Relations
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
    invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),

    // File Information
    fileName: varchar("file_name", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    url: varchar("url", { length: 500 }).notNull(),
    thumbnailUrl: varchar("thumbnail_url", { length: 500 }),

    // File Metadata
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 50 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),

    // Categorization
    category: varchar("category", { length: 100 }),
    tags: text("tags"),

    // Upload Information
    uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("attachments_company_idx").on(table.companyId),
    jobIdx: index("attachments_job_idx").on(table.jobId),
    invoiceIdx: index("attachments_invoice_idx").on(table.invoiceId),
    customerIdx: index("attachments_customer_idx").on(table.customerId),
    employeeIdx: index("attachments_employee_idx").on(table.employeeId),
    categoryIdx: index("attachments_category_idx").on(table.category),
  }),
)

// Quotes table - for customer quotations
export const quotes = pgTable(
  "quotes",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    
    // Quote Details
    quoteNumber: varchar("quote_number", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    
    // Financial
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
    taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
    discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
    total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 10 }).default("GBP"),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    validUntil: timestamp("valid_until"),
    
    // Security - access token for public accept/reject
    accessToken: varchar("access_token", { length: 255 }),
    
    // Notes
    notes: text("notes"),
    terms: text("terms"),
    
    // Timestamps
    sentAt: timestamp("sent_at"),
    acceptedAt: timestamp("accepted_at"),
    rejectedAt: timestamp("rejected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("quotes_company_idx").on(table.companyId),
    customerIdx: index("quotes_customer_idx").on(table.customerId),
    statusIdx: index("quotes_status_idx").on(table.status),
    quoteNumberIdx: uniqueIndex("quotes_quote_number_idx").on(table.companyId, table.quoteNumber),
    accessTokenIdx: index("quotes_access_token_idx").on(table.accessToken),
  }),
)

// Quote items table
export const quoteItems = pgTable(
  "quote_items",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    quoteIdx: index("quote_items_quote_idx").on(table.quoteId),
  }),
)

// Contracts table - recurring service agreements
export const contracts = pgTable(
  "contracts",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    quoteId: integer("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    
    // Contract Details
    contractNumber: varchar("contract_number", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    
      // Service Details
      serviceType: varchar("service_type", { length: 100 }),
      frequency: varchar("frequency", { length: 50 }), // weekly, biweekly, monthly
      planId: integer("plan_id").references(() => cleaningPlans.id, { onDelete: "set null" }),
      employeeIds: jsonb("employee_ids").default([]),
    
    // Duration
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    autoRenew: smallint("auto_renew").default(0),
    
// Schedule Details
    scheduleDays: jsonb("schedule_days").default([]), // Array of days: ["monday", "wednesday", "friday"]
    hoursPerWeek: decimal("hours_per_week", { precision: 6, scale: 2 }),
    hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),

    // Financial
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("GBP"),
    billingFrequency: varchar("billing_frequency", { length: 50 }), // monthly, quarterly, annually
    annualValue: decimal("annual_value", { precision: 12, scale: 2 }),
    nextInvoiceDate: date("next_invoice_date"),
    lastGeneratedDate: date("last_generated_date"),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    
    // Notes
    notes: text("notes"),
    terms: text("terms"),
    
    // Timestamps
    signedAt: timestamp("signed_at"),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("contracts_company_idx").on(table.companyId),
    customerIdx: index("contracts_customer_idx").on(table.customerId),
    statusIdx: index("contracts_status_idx").on(table.status),
    contractNumberIdx: uniqueIndex("contracts_contract_number_idx").on(table.companyId, table.contractNumber),
  }),
)

// Shifts table - employee work schedules
export const shifts = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    
    // Shift Details
    title: varchar("title", { length: 255 }),
    shiftType: varchar("shift_type", { length: 50 }), // regular, overtime, on-call
    
    // Schedule
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    breakMinutes: integer("break_minutes").default(0),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("scheduled"),
    
    // Actual Times (for time tracking)
    actualStartTime: timestamp("actual_start_time"),
    actualEndTime: timestamp("actual_end_time"),
    
    // Notes
    notes: text("notes"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("shifts_company_idx").on(table.companyId),
    employeeIdx: index("shifts_employee_idx").on(table.employeeId),
    startTimeIdx: index("shifts_start_time_idx").on(table.startTime),
    statusIdx: index("shifts_status_idx").on(table.status),
  }),
)

// Shift swap requests - swap assigned jobs between employees
export const shiftSwapRequests = pgTable(
  "shift_swap_requests",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fromEmployeeId: integer("from_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    toEmployeeId: integer("to_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    fromJobId: integer("from_job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    toJobId: integer("to_job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    requestedByEmployeeId: integer("requested_by_employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    requestedByRole: varchar("requested_by_role", { length: 20 }).notNull().default("company"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("shift_swap_requests_company_idx").on(table.companyId),
    statusIdx: index("shift_swap_requests_status_idx").on(table.status),
    fromEmployeeIdx: index("shift_swap_requests_from_employee_idx").on(table.fromEmployeeId),
    toEmployeeIdx: index("shift_swap_requests_to_employee_idx").on(table.toEmployeeId),
  }),
)

// Equipment table - company equipment/tools
export const equipment = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    
    // Equipment Details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }),
    serialNumber: varchar("serial_number", { length: 255 }),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("available"),
    condition: varchar("condition", { length: 50 }),
    
    // Assignment
    assignedTo: integer("assigned_to").references(() => employees.id, { onDelete: "set null" }),
    
    // Purchase Info
    purchaseDate: timestamp("purchase_date"),
    purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
    warrantyExpires: timestamp("warranty_expires"),
    
    // Maintenance
    lastMaintenanceDate: timestamp("last_maintenance_date"),
    nextMaintenanceDate: timestamp("next_maintenance_date"),
    
    // Notes
    notes: text("notes"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("equipment_company_idx").on(table.companyId),
    statusIdx: index("equipment_status_idx").on(table.status),
    categoryIdx: index("equipment_category_idx").on(table.category),
    assignedIdx: index("equipment_assigned_idx").on(table.assignedTo),
  }),
)

// Supplies/Inventory table
export const supplies = pgTable(
  "supplies",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    
    // Item Details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }), // Cleaning, Supplies, Equipment
    sku: varchar("sku", { length: 100 }),
    
    // Quantity
    quantity: integer("quantity").notNull().default(0),
    unit: varchar("unit", { length: 50 }), // bottles, pieces, boxes, etc.
    minQuantity: integer("min_quantity").default(5), // Low stock threshold
    
    // Pricing
    unitCost: decimal("unit_cost", { precision: 12, scale: 2 }),
    supplier: varchar("supplier", { length: 255 }),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("in-stock"), // in-stock, low-stock, out-of-stock
    
    // Notes
    notes: text("notes"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("supplies_company_idx").on(table.companyId),
    categoryIdx: index("supplies_category_idx").on(table.category),
    statusIdx: index("supplies_status_idx").on(table.status),
    skuIdx: index("supplies_sku_idx").on(table.sku),
  }),
)

// Supply Requests table - employees can request supplies
export const supplyRequests = pgTable(
  "supply_requests",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    
    // Request Details
    items: text("items").notNull(), // JSON array of items with name, quantity, category
    urgency: varchar("urgency", { length: 50 }).notNull().default("normal"), // low, normal, high, urgent
    notes: text("notes"),
    neededBy: timestamp("needed_by"),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, denied, fulfilled, cancelled
    
    // Review
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    
    // Fulfillment
    fulfilledAt: timestamp("fulfilled_at"),
    fulfilledBy: integer("fulfilled_by").references(() => users.id),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("supply_requests_company_idx").on(table.companyId),
    employeeIdx: index("supply_requests_employee_idx").on(table.employeeId),
    statusIdx: index("supply_requests_status_idx").on(table.status),
    urgencyIdx: index("supply_requests_urgency_idx").on(table.urgency),
  }),
)

// Employee Payouts table - track payments to employees for completed jobs
export const employeePayouts = pgTable(
  "employee_payouts",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    
    // Payout Details
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("GBP"),
    
    // Period covered
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    
    // Jobs included in this payout (JSON array of job IDs)
    jobIds: text("job_ids"), // JSON array: [1, 2, 3]
    jobCount: integer("job_count").default(0),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, paid, failed
    
    // Payment method and reference
    paymentMethod: varchar("payment_method", { length: 100 }), // bank_transfer, cash, paypal, etc.
    transactionReference: varchar("transaction_reference", { length: 255 }),
    
    // Notes
    notes: text("notes"),
    
    // Dates
    paidAt: timestamp("paid_at"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("employee_payouts_company_idx").on(table.companyId),
    employeeIdx: index("employee_payouts_employee_idx").on(table.employeeId),
    statusIdx: index("employee_payouts_status_idx").on(table.status),
    periodIdx: index("employee_payouts_period_idx").on(table.periodStart, table.periodEnd),
    paidAtIdx: index("employee_payouts_paid_at_idx").on(table.paidAt),
  }),
)

// Booking Requests table - customer-submitted booking requests
export const bookingRequests = pgTable(
  "booking_requests",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .references(() => customers.id, { onDelete: "set null" }),
    
    // Customer Info (for new customers who don't have an account yet)
    customerFirstName: varchar("customer_first_name", { length: 100 }).notNull(),
    customerLastName: varchar("customer_last_name", { length: 100 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 50 }),
    
    // Service Location
    address: text("address").notNull(),
    addressLine2: text("address_line_2"),
    city: varchar("city", { length: 100 }),
    postcode: varchar("postcode", { length: 50 }),
    accessInstructions: text("access_instructions"),
    
    // Service Details
    serviceType: varchar("service_type", { length: 100 }).notNull(), // regular, deep_clean, move_in, move_out, one_time, etc.
    propertyType: varchar("property_type", { length: 100 }), // house, apartment, office, etc.
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    squareFootage: integer("square_footage"),
    hasSpecialRequirements: smallint("has_special_requirements").default(0),
    specialRequirements: text("special_requirements"),
    
    // Scheduling
    preferredDate: timestamp("preferred_date"),
    preferredTimeSlot: varchar("preferred_time_slot", { length: 50 }), // morning, afternoon, evening, flexible
    alternateDate: timestamp("alternate_date"),
    frequency: varchar("frequency", { length: 50 }).default("one_time"), // one_time, weekly, biweekly, monthly
    
    // Pricing
    estimatedPrice: decimal("estimated_price", { precision: 10, scale: 2 }),
    quotedPrice: decimal("quoted_price", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 10 }).default("GBP"),
    
    // Status & Processing
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, reviewed, quoted, approved, converted, declined, cancelled
    priority: varchar("priority", { length: 50 }).default("normal"),
    
    // Admin Notes
    adminNotes: text("admin_notes"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    
    // Conversion to Job
    convertedToJobId: integer("converted_to_job_id").references(() => jobs.id),
    convertedAt: timestamp("converted_at"),
    convertedBy: integer("converted_by").references(() => users.id),
    
    // Source tracking
    source: varchar("source", { length: 100 }).default("website"), // website, widget, referral, phone, etc.
    referralCode: varchar("referral_code", { length: 100 }),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("booking_requests_company_idx").on(table.companyId),
    customerIdx: index("booking_requests_customer_idx").on(table.customerId),
    statusIdx: index("booking_requests_status_idx").on(table.status),
    emailIdx: index("booking_requests_email_idx").on(table.customerEmail),
    preferredDateIdx: index("booking_requests_date_idx").on(table.preferredDate),
  }),
)

// Service areas table
export const serviceAreas = pgTable(
  "service_areas",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    
    // Area Details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    
    // Geographic
    postcodes: text("postcodes"), // JSON array of postcodes
    city: varchar("city", { length: 100 }),
    radius: decimal("radius", { precision: 10, scale: 2 }), // in km
    centerLat: decimal("center_lat", { precision: 10, scale: 7 }),
    centerLng: decimal("center_lng", { precision: 10, scale: 7 }),
    
    // Status
    isActive: smallint("is_active").default(1),
    
    // Pricing
    surchargeAmount: decimal("surcharge_amount", { precision: 12, scale: 2 }),
    surchargePercent: decimal("surcharge_percent", { precision: 5, scale: 2 }),
    
    // Notes
    notes: text("notes"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("service_areas_company_idx").on(table.companyId),
    cityIdx: index("service_areas_city_idx").on(table.city),
  }),
)

// Messages table - internal messaging
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    
    // Sender/Recipient
    senderId: integer("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderType: varchar("sender_type", { length: 50 }), // user, employee, system
    recipientId: integer("recipient_id"),
    recipientType: varchar("recipient_type", { length: 50 }), // user, employee, customer, all
    
    // Message
    subject: varchar("subject", { length: 255 }),
    body: text("body").notNull(),
    messageType: varchar("message_type", { length: 50 }), // email, sms, push, internal
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("sent"),
    readAt: timestamp("read_at"),
    
    // Related
    jobId: integer("job_id").references(() => jobs.id, { onDelete: "set null" }),
    
    // Timestamps
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("messages_company_idx").on(table.companyId),
    senderIdx: index("messages_sender_idx").on(table.senderId),
    recipientIdx: index("messages_recipient_idx").on(table.recipientId, table.recipientType),
    statusIdx: index("messages_status_idx").on(table.status),
  }),
)

// Job templates table - reusable job configurations
export const jobTemplates = pgTable(
  "job_templates",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    
    // Template Details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }), // residential, commercial, etc.
    
    // Defaults
    defaultDuration: integer("default_duration"), // in minutes
    defaultPrice: decimal("default_price", { precision: 12, scale: 2 }),
    
    // Tasks (JSON array of task objects)
    tasks: text("tasks"), // JSON string
    
    // Settings
    isActive: smallint("is_active").default(1),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("job_templates_company_idx").on(table.companyId),
    categoryIdx: index("job_templates_category_idx").on(table.category),
  }),
)

// Subscriptions table - recurring service agreements
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    
    // Subscription Details
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    
    // Services (JSON array)
    services: text("services"), // JSON string
    
    // Pricing
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).default("GBP"),
    
    // Schedule
    frequency: varchar("frequency", { length: 50 }).notNull(), // weekly, bi-weekly, monthly
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    nextBillingDate: timestamp("next_billing_date"),
    
    // Status
    status: varchar("status", { length: 50 }).notNull().default("active"),
    
    // Payment
    paymentMethod: varchar("payment_method", { length: 100 }),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("subscriptions_company_idx").on(table.companyId),
    customerIdx: index("subscriptions_customer_idx").on(table.customerId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
    nextBillingIdx: index("subscriptions_next_billing_idx").on(table.nextBillingDate),
  }),
)

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  employees: many(employees),
  jobs: many(jobs),
  attachments: many(attachments),
}))

export const userRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  passwordResetTokens: many(passwordResetTokens),
}))

export const passwordResetTokenRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}))

export const customerRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, {
    fields: [customers.companyId],
    references: [companies.id],
  }),
  addresses: many(customerAddresses),
  jobs: many(jobs),
  invoices: many(invoices),
  payments: many(payments),
  attachments: many(attachments),
}))

export const customerAddressRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}))

export const employeeRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, {
    fields: [employees.companyId],
    references: [companies.id],
  }),
  jobs: many(jobs),
  jobTasksCompleted: many(jobTasks),
  workSessions: many(workSessions),
  jobEvents: many(jobEvents),
  teamMembers: many(teamMembers),
}))

export const teamRelations = relations(teams, ({ one, many }) => ({
  company: one(companies, {
    fields: [teams.companyId],
    references: [companies.id],
  }),
  members: many(teamMembers),
}))

export const teamMemberRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  employee: one(employees, {
    fields: [teamMembers.employeeId],
    references: [employees.id],
  }),
}))

export const jobRelations = relations(jobs, ({ one, many }) => ({
  company: one(companies, {
    fields: [jobs.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [jobs.customerId],
    references: [customers.id],
  }),
  assignee: one(employees, {
    fields: [jobs.assignedTo],
    references: [employees.id],
  }),
  plan: one(cleaningPlans, {
    fields: [jobs.planId],
    references: [cleaningPlans.id],
  }),
  tasks: many(jobTasks),
  assignments: many(jobAssignments),
  invoices: many(invoices),
  events: many(jobEvents),
  workSessions: many(workSessions),
  attachments: many(attachments),
}))

export const jobAssignmentRelations = relations(jobAssignments, ({ one }) => ({
  job: one(jobs, {
    fields: [jobAssignments.jobId],
    references: [jobs.id],
  }),
  employee: one(employees, {
    fields: [jobAssignments.employeeId],
    references: [employees.id],
  }),
  company: one(companies, {
    fields: [jobAssignments.companyId],
    references: [companies.id],
  }),
}))

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  payments: many(payments),
  items: many(invoiceItems),
  attachments: many(attachments),
}))

export const paymentRelations = relations(payments, ({ one }) => ({
  company: one(companies, {
    fields: [payments.companyId],
    references: [companies.id],
  }),
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [payments.customerId],
    references: [customers.id],
  }),
}))

export const cleaningPlanRelations = relations(cleaningPlans, ({ many }) => ({
  tasks: many(planTasks),
  jobs: many(jobs),
}))

export const planTaskRelations = relations(planTasks, ({ one }) => ({
  plan: one(cleaningPlans, {
    fields: [planTasks.planId],
    references: [cleaningPlans.id],
  }),
}))

export const jobTaskRelations = relations(jobTasks, ({ one }) => ({
  job: one(jobs, {
    fields: [jobTasks.jobId],
    references: [jobs.id],
  }),
  completedBy: one(employees, {
    fields: [jobTasks.completedBy],
    references: [employees.id],
  }),
}))

export const jobEventRelations = relations(jobEvents, ({ one }) => ({
  job: one(jobs, {
    fields: [jobEvents.jobId],
    references: [jobs.id],
  }),
  actor: one(employees, {
    fields: [jobEvents.actorId],
    references: [employees.id],
  }),
}))

export const workSessionRelations = relations(workSessions, ({ one }) => ({
  employee: one(employees, {
    fields: [workSessions.employeeId],
    references: [employees.id],
  }),
  job: one(jobs, {
    fields: [workSessions.jobId],
    references: [jobs.id],
  }),
}))

export const attachmentRelations = relations(attachments, ({ one }) => ({
  company: one(companies, {
    fields: [attachments.companyId],
    references: [companies.id],
  }),
  job: one(jobs, {
    fields: [attachments.jobId],
    references: [jobs.id],
  }),
  invoice: one(invoices, {
    fields: [attachments.invoiceId],
    references: [invoices.id],
  }),
  customer: one(customers, {
    fields: [attachments.customerId],
    references: [customers.id],
  }),
  employee: one(employees, {
    fields: [attachments.employeeId],
    references: [employees.id],
  }),
  uploadedBy: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}))

// Quote relations
export const quoteRelations = relations(quotes, ({ one, many }) => ({
  company: one(companies, {
    fields: [quotes.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  items: many(quoteItems),
}))

export const quoteItemRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
}))

// Contract relations
export const contractRelations = relations(contracts, ({ one }) => ({
  company: one(companies, {
    fields: [contracts.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [contracts.customerId],
    references: [customers.id],
  }),
  plan: one(cleaningPlans, {
    fields: [contracts.planId],
    references: [cleaningPlans.id],
  }),
}))

// Shift relations
export const shiftRelations = relations(shifts, ({ one }) => ({
  company: one(companies, {
    fields: [shifts.companyId],
    references: [companies.id],
  }),
  employee: one(employees, {
    fields: [shifts.employeeId],
    references: [employees.id],
  }),
}))

// Shift swap request relations
export const shiftSwapRequestRelations = relations(shiftSwapRequests, ({ one }) => ({
  company: one(companies, {
    fields: [shiftSwapRequests.companyId],
    references: [companies.id],
  }),
  fromEmployee: one(employees, {
    fields: [shiftSwapRequests.fromEmployeeId],
    references: [employees.id],
  }),
  toEmployee: one(employees, {
    fields: [shiftSwapRequests.toEmployeeId],
    references: [employees.id],
  }),
  requestedBy: one(employees, {
    fields: [shiftSwapRequests.requestedByEmployeeId],
    references: [employees.id],
  }),
  fromJob: one(jobs, {
    fields: [shiftSwapRequests.fromJobId],
    references: [jobs.id],
  }),
  toJob: one(jobs, {
    fields: [shiftSwapRequests.toJobId],
    references: [jobs.id],
  }),
}))

// Time-off request relations
export const timeOffRequestRelations = relations(timeOffRequests, ({ one }) => ({
  company: one(companies, {
    fields: [timeOffRequests.companyId],
    references: [companies.id],
  }),
  employee: one(employees, {
    fields: [timeOffRequests.employeeId],
    references: [employees.id],
  }),
  reviewer: one(users, {
    fields: [timeOffRequests.reviewedBy],
    references: [users.id],
  }),
}))

// Equipment relations
export const equipmentRelations = relations(equipment, ({ one }) => ({
  company: one(companies, {
    fields: [equipment.companyId],
    references: [companies.id],
  }),
  assignedEmployee: one(employees, {
    fields: [equipment.assignedTo],
    references: [employees.id],
  }),
}))

// Service area relations
export const serviceAreaRelations = relations(serviceAreas, ({ one }) => ({
  company: one(companies, {
    fields: [serviceAreas.companyId],
    references: [companies.id],
  }),
}))

// Booking request relations
export const bookingRequestRelations = relations(bookingRequests, ({ one }) => ({
  company: one(companies, {
    fields: [bookingRequests.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [bookingRequests.customerId],
    references: [customers.id],
  }),
  reviewer: one(users, {
    fields: [bookingRequests.reviewedBy],
    references: [users.id],
  }),
  convertedJob: one(jobs, {
    fields: [bookingRequests.convertedToJobId],
    references: [jobs.id],
  }),
  converter: one(users, {
    fields: [bookingRequests.convertedBy],
    references: [users.id],
  }),
}))

// Message relations
export const messageRelations = relations(messages, ({ one }) => ({
  company: one(companies, {
    fields: [messages.companyId],
    references: [companies.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [messages.jobId],
    references: [jobs.id],
  }),
}))

// Job template relations
export const jobTemplateRelations = relations(jobTemplates, ({ one }) => ({
  company: one(companies, {
    fields: [jobTemplates.companyId],
    references: [companies.id],
  }),
}))

// Subscription relations
export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  company: one(companies, {
    fields: [subscriptions.companyId],
    references: [companies.id],
  }),
  customer: one(customers, {
    fields: [subscriptions.customerId],
    references: [customers.id],
  }),
}))

// Supplies relations
export const suppliesRelations = relations(supplies, ({ one }) => ({
  company: one(companies, {
    fields: [supplies.companyId],
    references: [companies.id],
  }),
}))

// Supply Requests relations
export const supplyRequestsRelations = relations(supplyRequests, ({ one }) => ({
  company: one(companies, {
    fields: [supplyRequests.companyId],
    references: [companies.id],
  }),
  employee: one(employees, {
    fields: [supplyRequests.employeeId],
    references: [employees.id],
  }),
  reviewer: one(users, {
    fields: [supplyRequests.reviewedBy],
    references: [users.id],
  }),
  fulfiller: one(users, {
    fields: [supplyRequests.fulfilledBy],
    references: [users.id],
  }),
}))

// Employee Payouts relations
export const employeePayoutsRelations = relations(employeePayouts, ({ one }) => ({
  company: one(companies, {
    fields: [employeePayouts.companyId],
    references: [companies.id],
  }),
  employee: one(employees, {
    fields: [employeePayouts.employeeId],
    references: [employees.id],
  }),
  createdByUser: one(users, {
    fields: [employeePayouts.createdBy],
    references: [users.id],
  }),
}))

export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type CustomerAddress = typeof customerAddresses.$inferSelect
export type NewCustomerAddress = typeof customerAddresses.$inferInsert
export type Employee = typeof employees.$inferSelect
export type NewEmployee = typeof employees.$inferInsert
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type JobAssignment = typeof jobAssignments.$inferSelect
export type NewJobAssignment = typeof jobAssignments.$inferInsert
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type CleaningPlan = typeof cleaningPlans.$inferSelect
export type NewCleaningPlan = typeof cleaningPlans.$inferInsert
export type PlanTask = typeof planTasks.$inferSelect
export type NewPlanTask = typeof planTasks.$inferInsert
export type JobTask = typeof jobTasks.$inferSelect
export type NewJobTask = typeof jobTasks.$inferInsert
export type InvoiceItem = typeof invoiceItems.$inferSelect
export type NewInvoiceItem = typeof invoiceItems.$inferInsert
export type JobEvent = typeof jobEvents.$inferSelect
export type NewJobEvent = typeof jobEvents.$inferInsert
export type WorkSession = typeof workSessions.$inferSelect
export type NewWorkSession = typeof workSessions.$inferInsert
export type Attachment = typeof attachments.$inferSelect
export type NewAttachment = typeof attachments.$inferInsert
export type Quote = typeof quotes.$inferSelect
export type NewQuote = typeof quotes.$inferInsert
export type QuoteItem = typeof quoteItems.$inferSelect
export type NewQuoteItem = typeof quoteItems.$inferInsert
export type Contract = typeof contracts.$inferSelect
export type NewContract = typeof contracts.$inferInsert
export type Shift = typeof shifts.$inferSelect
export type NewShift = typeof shifts.$inferInsert
export type ShiftSwapRequest = typeof shiftSwapRequests.$inferSelect
export type NewShiftSwapRequest = typeof shiftSwapRequests.$inferInsert
export type TimeOffRequest = typeof timeOffRequests.$inferSelect
export type NewTimeOffRequest = typeof timeOffRequests.$inferInsert
export type Team = typeof teams.$inferSelect
export type NewTeam = typeof teams.$inferInsert
export type TeamMember = typeof teamMembers.$inferSelect
export type NewTeamMember = typeof teamMembers.$inferInsert
export type Equipment = typeof equipment.$inferSelect
export type NewEquipment = typeof equipment.$inferInsert
export type ServiceArea = typeof serviceAreas.$inferSelect
export type NewServiceArea = typeof serviceAreas.$inferInsert
export type BookingRequest = typeof bookingRequests.$inferSelect
export type NewBookingRequest = typeof bookingRequests.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type JobTemplate = typeof jobTemplates.$inferSelect
export type NewJobTemplate = typeof jobTemplates.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type Supply = typeof supplies.$inferSelect
export type NewSupply = typeof supplies.$inferInsert
export type SupplyRequest = typeof supplyRequests.$inferSelect
export type NewSupplyRequest = typeof supplyRequests.$inferInsert
export type EmployeePayout = typeof employeePayouts.$inferSelect
export type NewEmployeePayout = typeof employeePayouts.$inferInsert
export type Feature = typeof features.$inferSelect
export type NewFeature = typeof features.$inferInsert
export type CompanyFeature = typeof companyFeatures.$inferSelect
export type NewCompanyFeature = typeof companyFeatures.$inferInsert
