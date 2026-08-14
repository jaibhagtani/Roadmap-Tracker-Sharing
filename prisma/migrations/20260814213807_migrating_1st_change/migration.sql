-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "public"."Privacy" AS ENUM ('private', 'link', 'public');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roadmaps" (
    "id" UUID NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "privacy" "public"."Privacy" NOT NULL DEFAULT 'private',
    "share_slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."topics" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "parent_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "public"."Status" NOT NULL DEFAULT 'not_started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "due_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resources" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "notes" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."todos" (
    "id" UUID NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "roadmap_id" UUID,
    "topic_id" UUID,
    "todo_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_logs" (
    "id" UUID NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "log_date" DATE NOT NULL,
    "study_minutes" INTEGER NOT NULL DEFAULT 0,
    "topics_studied" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resources_completed" INTEGER NOT NULL DEFAULT 0,
    "problems_solved" INTEGER NOT NULL DEFAULT 0,
    "learned" TEXT NOT NULL DEFAULT '',
    "difficulties" TEXT NOT NULL DEFAULT '',
    "tomorrow_goal" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goals" (
    "id" UUID NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "roadmap_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "deadline" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."Status" NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tree" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" VARCHAR(255) NOT NULL,
    "full_name" TEXT NOT NULL DEFAULT '',
    "avatar_url" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roadmap_shares" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."share_requests" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID,
    "root_topic_id" UUID,
    "template_id" UUID,
    "scope_type" TEXT NOT NULL DEFAULT 'roadmap',
    "sender_id" VARCHAR(255) NOT NULL,
    "receiver_id" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."topic_shares" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roadmapId" UUID,

    CONSTRAINT "topic_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."template_shares" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "share_request_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "public"."sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "public"."sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "public"."password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "roadmaps_share_slug_key" ON "public"."roadmaps"("share_slug");

-- CreateIndex
CREATE INDEX "topics_roadmap_id_parent_id_position_idx" ON "public"."topics"("roadmap_id", "parent_id", "position");

-- CreateIndex
CREATE INDEX "resources_topic_id_idx" ON "public"."resources"("topic_id");

-- CreateIndex
CREATE INDEX "todos_owner_id_todo_date_position_idx" ON "public"."todos"("owner_id", "todo_date", "position");

-- CreateIndex
CREATE UNIQUE INDEX "daily_logs_owner_id_log_date_key" ON "public"."daily_logs"("owner_id", "log_date");

-- CreateIndex
CREATE INDEX "goals_owner_id_deadline_idx" ON "public"."goals"("owner_id", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_key" ON "public"."templates"("name");

-- CreateIndex
CREATE INDEX "roadmap_shares_user_id_idx" ON "public"."roadmap_shares"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roadmap_shares_roadmap_id_user_id_key" ON "public"."roadmap_shares"("roadmap_id", "user_id");

-- CreateIndex
CREATE INDEX "share_requests_receiver_id_status_created_at_idx" ON "public"."share_requests"("receiver_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "share_requests_sender_id_created_at_idx" ON "public"."share_requests"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "share_requests_roadmap_id_root_topic_id_receiver_id_status_idx" ON "public"."share_requests"("roadmap_id", "root_topic_id", "receiver_id", "status");

-- CreateIndex
CREATE INDEX "topic_shares_user_id_idx" ON "public"."topic_shares"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_shares_topic_id_user_id_key" ON "public"."topic_shares"("topic_id", "user_id");

-- CreateIndex
CREATE INDEX "template_shares_user_id_idx" ON "public"."template_shares"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_shares_template_id_user_id_key" ON "public"."template_shares"("template_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "public"."notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resources" ADD CONSTRAINT "resources_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."todos" ADD CONSTRAINT "todos_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."todos" ADD CONSTRAINT "todos_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goals" ADD CONSTRAINT "goals_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roadmap_shares" ADD CONSTRAINT "roadmap_shares_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."share_requests" ADD CONSTRAINT "share_requests_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."share_requests" ADD CONSTRAINT "share_requests_root_topic_id_fkey" FOREIGN KEY ("root_topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."share_requests" ADD CONSTRAINT "share_requests_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topic_shares" ADD CONSTRAINT "topic_shares_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topic_shares" ADD CONSTRAINT "topic_shares_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "public"."roadmaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."template_shares" ADD CONSTRAINT "template_shares_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_share_request_id_fkey" FOREIGN KEY ("share_request_id") REFERENCES "public"."share_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
