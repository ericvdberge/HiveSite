using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hivesite.Content.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateSites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "content");

            migrationBuilder.CreateTable(
                name: "sites",
                schema: "content",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ownerId = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    language = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pkSites", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ixSitesOwnerIdCreatedAtId",
                schema: "content",
                table: "sites",
                columns: new[] { "ownerId", "createdAt", "id" },
                descending: new[] { false, true, false });

            migrationBuilder.CreateIndex(
                name: "ixSitesSlug",
                schema: "content",
                table: "sites",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sites",
                schema: "content");
        }
    }
}
