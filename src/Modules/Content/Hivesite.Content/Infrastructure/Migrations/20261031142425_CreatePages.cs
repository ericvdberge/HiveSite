using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hivesite.Content.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreatePages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "pages",
                schema: "content",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    siteId = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    slug = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    menuOrder = table.Column<int>(type: "integer", nullable: false),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pkPages", x => x.id);
                    table.ForeignKey(
                        name: "fkPagesSiteId",
                        column: x => x.siteId,
                        principalSchema: "content",
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ixPagesSiteIdMenuOrder",
                schema: "content",
                table: "pages",
                columns: new[] { "siteId", "menuOrder" });

            migrationBuilder.CreateIndex(
                name: "ixPagesSiteIdSlug",
                schema: "content",
                table: "pages",
                columns: new[] { "siteId", "slug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "pages",
                schema: "content");
        }
    }
}
