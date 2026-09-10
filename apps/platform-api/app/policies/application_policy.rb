class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    raise Pundit::NotAuthorizedError unless user
    @user = user
    @record = record
  end

  def index? = false
  def show? = owns_record?
  def create? = owns_record?
  def update? = owns_record?
  def destroy? = owns_record?

  private

  def owns_record?
    record.respond_to?(:user_id) && record.user_id == user.id
  end

  class Scope
    def initialize(user, scope)
      raise Pundit::NotAuthorizedError unless user
      @user = user
      @scope = scope
    end

    def resolve = @scope.where(user_id: @user.id)
  end
end
