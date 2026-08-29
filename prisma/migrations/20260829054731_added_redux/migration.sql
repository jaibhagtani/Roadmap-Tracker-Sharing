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
    "email_verified_at" TIMESTAMP(3),
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
    "version" INTEGER NOT NULL DEFAULT 0,
    "editor_state" JSONB NOT NULL DEFAULT '{}',

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
    "share_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_topic_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'learning',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_topic_progress_pkey" PRIMARY KEY ("id")
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
    "priority" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'private',
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
    "role" TEXT NOT NULL DEFAULT 'contributor',
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
    "request_type" TEXT NOT NULL DEFAULT 'share',
    "sender_id" VARCHAR(255) NOT NULL,
    "receiver_id" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'contributor',
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
    "role" TEXT NOT NULL DEFAULT 'contributor',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
    "roadmap_id" UUID,
    "share_request_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collab_group_join_request_id" UUID,
    "collab_commit_id" UUID,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collab_branches" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "root_topic_id" UUID,
    "base_version" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collab_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collab_commits" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "author_id" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "base_version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "merged_at" TIMESTAMP(3),
    "merged_by" VARCHAR(255),

    CONSTRAINT "collab_commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaboration_events" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "actor_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaboration_messages" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "author_id" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collaboration_presence" (
    "roadmap_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_presence_pkey" PRIMARY KEY ("roadmap_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."collab_groups" (
    "id" UUID NOT NULL,
    "roadmap_id" UUID NOT NULL,
    "owner_id" VARCHAR(255) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "max_members" INTEGER NOT NULL DEFAULT 10,
    "discoverable" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "invite_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collab_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collab_group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collab_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."collab_group_join_requests" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "requester_id" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collab_group_join_requests_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "topics_share_token_key" ON "public"."topics"("share_token");

-- CreateIndex
CREATE INDEX "topics_roadmap_id_parent_id_position_idx" ON "public"."topics"("roadmap_id", "parent_id", "position");

-- CreateIndex
CREATE INDEX "user_topic_progress_user_id_updated_at_idx" ON "public"."user_topic_progress"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "user_topic_progress_topic_id_idx" ON "public"."user_topic_progress"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_topic_progress_user_id_topic_id_key" ON "public"."user_topic_progress"("user_id", "topic_id");

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

-- CreateIndex
CREATE INDEX "collab_branches_roadmap_id_status_updated_at_idx" ON "public"."collab_branches"("roadmap_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "collab_branches_owner_id_status_updated_at_idx" ON "public"."collab_branches"("owner_id", "status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "collab_branches_roadmap_id_owner_id_name_key" ON "public"."collab_branches"("roadmap_id", "owner_id", "name");

-- CreateIndex
CREATE INDEX "collab_commits_branch_id_created_at_idx" ON "public"."collab_commits"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "collab_commits_status_created_at_idx" ON "public"."collab_commits"("status", "created_at");

-- CreateIndex
CREATE INDEX "collaboration_events_roadmap_id_created_at_idx" ON "public"."collaboration_events"("roadmap_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_events_roadmap_id_version_key" ON "public"."collaboration_events"("roadmap_id", "version");

-- CreateIndex
CREATE INDEX "collaboration_messages_roadmap_id_created_at_idx" ON "public"."collaboration_messages"("roadmap_id", "created_at");

-- CreateIndex
CREATE INDEX "collaboration_presence_roadmap_id_last_seen_idx" ON "public"."collaboration_presence"("roadmap_id", "last_seen");

-- CreateIndex
CREATE UNIQUE INDEX "collab_groups_roadmap_id_key" ON "public"."collab_groups"("roadmap_id");

-- CreateIndex
CREATE UNIQUE INDEX "collab_groups_invite_token_key" ON "public"."collab_groups"("invite_token");

-- CreateIndex
CREATE INDEX "collab_groups_discoverable_created_at_idx" ON "public"."collab_groups"("discoverable", "created_at");

-- CreateIndex
CREATE INDEX "collab_groups_owner_id_idx" ON "public"."collab_groups"("owner_id");

-- CreateIndex
CREATE INDEX "collab_group_members_user_id_idx" ON "public"."collab_group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collab_group_members_group_id_user_id_key" ON "public"."collab_group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "collab_group_join_requests_group_id_status_created_at_idx" ON "public"."collab_group_join_requests"("group_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "collab_group_join_requests_requester_id_status_created_at_idx" ON "public"."collab_group_join_requests"("requester_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_topic_progress" ADD CONSTRAINT "user_topic_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_topic_progress" ADD CONSTRAINT "user_topic_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "public"."template_shares" ADD CONSTRAINT "template_shares_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_share_request_id_fkey" FOREIGN KEY ("share_request_id") REFERENCES "public"."share_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_collab_group_join_request_id_fkey" FOREIGN KEY ("collab_group_join_request_id") REFERENCES "public"."collab_group_join_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_collab_commit_id_fkey" FOREIGN KEY ("collab_commit_id") REFERENCES "public"."collab_commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collab_branches" ADD CONSTRAINT "collab_branches_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collab_commits" ADD CONSTRAINT "collab_commits_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."collab_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaboration_events" ADD CONSTRAINT "collaboration_events_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaboration_messages" ADD CONSTRAINT "collaboration_messages_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collaboration_presence" ADD CONSTRAINT "collaboration_presence_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collab_groups" ADD CONSTRAINT "collab_groups_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collab_group_members" ADD CONSTRAINT "collab_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."collab_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."collab_group_join_requests" ADD CONSTRAINT "collab_group_join_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."collab_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
