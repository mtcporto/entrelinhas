import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("user"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => ({ emailUnique: uniqueIndex("user_email_unique").on(table.email) }));

export const session = sqliteTable("session", {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
}, (table) => ({ tokenUnique: uniqueIndex("session_token_unique").on(table.token), userIndex: index("session_user_id_index").on(table.userId) }));

export const account = sqliteTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    issuer: text("issuer").notNull().default(""),
}, (table) => ({ issuerAccountUnique: uniqueIndex("account_issuer_account_id_unique").on(table.issuer, table.accountId), userIndex: index("account_user_id_index").on(table.userId) }));

export const verification = sqliteTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => ({ identifierIndex: index("verification_identifier_index").on(table.identifier) }));

export const readingLists = sqliteTable("reading_lists", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => ({ userIndex: index("reading_lists_user_id_index").on(table.userId) }));

export const readingListBooks = sqliteTable("reading_list_books", {
    listId: text("list_id").notNull(),
    bookId: text("book_id").notNull(),
    bookData: text("book_data").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => ({ bookUnique: uniqueIndex("reading_list_books_unique").on(table.listId, table.bookId) }));

export const editorialProfiles = sqliteTable("editorial_profiles", {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    editorial: text("editorial").notNull(),
    themesJson: text("themes_json").notNull().default("[]"),
    updatedAt: integer("updated_at").notNull(),
}, (table) => ({ profilePk: uniqueIndex("editorial_profiles_pk").on(table.entityType, table.entityId) }));

export const editorialSources = sqliteTable("editorial_sources", {
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    label: text("label").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
}, (table) => ({ sourcePk: uniqueIndex("editorial_sources_pk").on(table.entityType, table.entityId, table.url), entityIndex: index("editorial_sources_entity_index").on(table.entityType, table.entityId) }));

export const authSchema = { user, session, account, verification, editorialProfiles, editorialSources };
