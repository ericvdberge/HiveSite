using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hivesite.Content.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteTheme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "theme",
                schema: "content",
                table: "sites",
                type: "text",
                nullable: false,
                defaultValue: "atelier");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "theme",
                schema: "content",
                table: "sites");
        }
    }
}
